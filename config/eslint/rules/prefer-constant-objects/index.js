import ts from 'typescript';

const catalogsByProgram = new WeakMap();

/**
 * Reads only literal catalog members, including signed numbers and plain template strings.
 * @param {ts.Node | undefined} node Possible literal initializer.
 * @return {string | number | undefined} Literal value without evaluating application code.
 */
function literalValue( node ) {
	if ( ! node ) {
		return undefined;
	}
	if ( ts.isStringLiteralLike( node ) ) {
		return node.text;
	}
	if ( ts.isNumericLiteral( node ) ) {
		return Number( node.text );
	}
	if ( ts.isPrefixUnaryExpression( node ) && ts.isNumericLiteral( node.operand )
		&& [ ts.SyntaxKind.MinusToken, ts.SyntaxKind.PlusToken ].includes( node.operator ) ) {
		return Number( node.operand.text ) * ( node.operator === ts.SyntaxKind.MinusToken ? -1 : 1 );
	}
	return undefined;
}

/**
 * Determines whether a contextual API is declared by a dependency rather than TOCus.
 * @param {ts.Node} node Literal or enclosing argument.
 * @param {ts.TypeChecker} checker Current checker.
 * @return {boolean} Whether signature-based inference would cross an upstream ownership boundary.
 */
function externalContext( node, checker ) {
	const parent = node.parent;
	const ownSymbol = checker.getSymbolAtLocation( node );
	if ( ownSymbol?.declarations?.some( ( declaration ) =>
		declaration.getSourceFile().fileName.includes( '/node_modules/' ) ) ) {
		return true;
	}
	if ( ts.isCallExpression( parent ) ) {
		return checker.getResolvedSignature( parent )?.declaration?.getSourceFile().fileName
			.includes( '/node_modules/' ) ?? false;
	}
	if ( ts.isPropertyAssignment( parent ) && ts.isIdentifier( parent.name ) ) {
		const object = checker.getContextualType( parent.parent );
		const property = object?.getProperty( parent.name.text );
		if ( property?.declarations?.some( ( declaration ) =>
			declaration.getSourceFile().fileName.includes( '/node_modules/' ) ) ) {
			return true;
		}
	}
	if ( ts.isPropertyAssignment( parent ) || ts.isArrayLiteralExpression( parent )
		|| ts.isObjectLiteralExpression( parent ) ) {
		return externalContext( parent, checker );
	}
	const symbol = ts.isJsxAttribute( parent ) ? checker.getSymbolAtLocation( parent.name ) : undefined;
	return symbol?.declarations?.some( ( declaration ) =>
		declaration.getSourceFile().fileName.includes( '/node_modules/' ) ) ?? false;
}

/**
 * Creates an order-independent signature without conflating numeric and string values.
 * @param {Array<string | number>} values Finite domain values.
 * @return {string} Stable lookup signature.
 */
function signature( values ) {
	return values.map( ( value ) => JSON.stringify( [ typeof value, value ] ) ).sort().join( ',' );
}

/**
 * Indexes owned constant objects once per project so schema-inferred unions can recover their names.
 * @param {ts.Program} program Current TypeScript project.
 * @return {Map<string, Array<{name: string, source: string, members: Map<string | number, string>}>>} Catalogs by finite value signature.
 */
function catalogs( program ) {
	if ( catalogsByProgram.has( program ) ) {
		return catalogsByProgram.get( program );
	}
	const result = new Map();
	for ( const source of program.getSourceFiles() ) {
		if ( source.isDeclarationFile || source.fileName.includes( '/node_modules/' ) ) {
			continue;
		}
		const declarations = source.statements.filter( ts.isTypeAliasDeclaration );
		const aliases = new Map( declarations.map( ( node ) => [ node.name.text, node ] ) );
		for ( const statement of source.statements.filter( ts.isVariableStatement ) ) {
			for ( const variable of statement.declarationList.declarations ) {
				const object = unwrap( variable.initializer );
				if ( ! ts.isIdentifier( variable.name ) || ! aliases.has( variable.name.text )
					|| ! object || ! ts.isObjectLiteralExpression( object ) ) {
					continue;
				}
				const members = new Map();
				for ( const property of object.properties ) {
					if ( ! ts.isPropertyAssignment( property ) || ! ts.isIdentifier( property.name ) ) {
						continue;
					}
					const value = literalValue( unwrap( property.initializer ) );
					if ( value !== undefined ) {
						members.set( value, property.name.text );
					}
				}
				if ( members.size < 2 || members.size !== object.properties.length ) {
					continue;
				}
				const key = signature( [ ...members.keys() ] );
				const alias = program.getTypeChecker().getTypeAtLocation( aliases.get( variable.name.text ) );
				if ( ! alias.isUnion() || signature( alias.types.map( ( type ) => type.value ) ) !== key ) {
					continue;
				}
				const entries = result.get( key ) ?? [];
				entries.push( { name: variable.name.text, source: source.fileName, members } );
				result.set( key, entries );
			}
		}
	}
	catalogsByProgram.set( program, result );
	return result;
}

/**
 * Resolves declared or schema-inferred domains through the same validated catalog index.
 * @param {ts.Type | undefined} type Contextual or compared type.
 * @param {string | number} value Raw literal consumer.
 * @param {import('eslint').Scope.Scope} scope Literal's lexical scope.
 * @param {ts.Program} program Current project.
 * @param {boolean} allowInferred Whether schema inference is inside the application's ownership boundary.
 * @return {string | undefined} Named reference when its provenance is unambiguous.
 */
function constantReference( type, value, scope, program, allowInferred ) {
	if ( ! type || type.aliasSymbol?.declarations?.some( ( declaration ) =>
		declaration.getSourceFile().fileName.includes( '/node_modules/' ) ) ) {
		return undefined;
	}
	const variants = program.getTypeChecker().getNonNullableType( type );
	if ( ! variants.isUnion()
		|| ! variants.types.every( ( member ) => member.isStringLiteral() || member.isNumberLiteral() ) ) {
		return undefined;
	}
	const matches = catalogs( program ).get( signature( variants.types.map( ( member ) => member.value ) ) ) ?? [];
	const declared = matches.find( ( entry ) => entry.name === type.aliasSymbol?.name
		&& type.aliasSymbol.declarations?.some( ( declaration ) =>
			declaration.getSourceFile().fileName === entry.source ) );
	if ( declared?.members.has( value ) ) {
		return `${ declared.name }.${ declared.members.get( value ) }`;
	}
	if ( ! allowInferred ) {
		return undefined;
	}
	const visible = new Set();
	for ( let current = scope; current; current = current.upper ) {
		for ( const name of current.set.keys() ) {
			visible.add( name );
		}
	}
	const inScope = matches.filter( ( entry ) => visible.has( entry.name ) );
	const candidates = inScope.length ? inScope : matches;
	const selected = candidates.length === 1 ? candidates[ 0 ] : undefined;
	return selected?.members.has( value ) ? `${ selected.name }.${ selected.members.get( value ) }` : undefined;
}

/**
 * Removes assertions and parentheses around a constant object's initializer.
 * @param {ts.Expression | undefined} expression Initializer to inspect.
 * @return {ts.Expression | undefined} Underlying initializer without type-only wrappers.
 */
function unwrap( expression ) {
	while ( expression && ( ts.isAsExpression( expression ) || ts.isSatisfiesExpression( expression )
		|| ts.isParenthesizedExpression( expression ) ) ) {
		expression = expression.expression;
	}
	return expression;
}

/**
 * Reads the actual value in an expect(value).toBe(expected) assertion.
 * @param {ts.Node} node Matcher argument being inspected.
 * @param {ts.TypeChecker} checker Current project's TypeScript checker.
 * @return {ts.Type | undefined} Type of the actual asserted value.
 */
function matcherType( node, checker ) {
	if ( ts.isPropertyAssignment( node.parent ) && node.parent.initializer === node
		&& ( ts.isIdentifier( node.parent.name ) || ts.isStringLiteral( node.parent.name ) ) ) {
		const object = matcherType( node.parent.parent, checker );
		return object ? checker.getTypeOfPropertyOfType( object, node.parent.name.text ) : undefined;
	}
	if ( ts.isArrayLiteralExpression( node.parent ) ) {
		const array = matcherType( node.parent, checker );
		return array ? checker.getIndexTypeOfType( array, ts.IndexKind.Number ) : undefined;
	}
	const call = node.parent;
	if ( ! ts.isCallExpression( call ) || ! ts.isPropertyAccessExpression( call.expression )
		|| ! [ 'toBe', 'toEqual', 'toStrictEqual', 'toMatchObject' ].includes( call.expression.name.text ) ) {
		return undefined;
	}
	let receiver = call.expression.expression;
	while ( ts.isPropertyAccessExpression( receiver ) ) {
		receiver = receiver.expression;
	}
	if ( ! ts.isCallExpression( receiver ) || ! ts.isIdentifier( receiver.expression )
		|| receiver.expression.text !== 'expect' || ! receiver.arguments[ 0 ] ) {
		return undefined;
	}
	return checker.getTypeAtLocation( receiver.arguments[ 0 ] );
}

/**
 * Identifies key selections, which describe existing properties rather than new finite-domain types.
 * @param {import('@typescript-eslint/types').TSESTree.TSUnionType} node Union being inspected.
 * @return {boolean} Whether the union selects existing contract property names.
 */
function isKeySelection( node ) {
	const parent = node.parent;
	if ( parent.type === 'TSIndexedAccessType' && parent.indexType === node ) {
		return true;
	}
	const reference = parent.parent;
	const name = reference.type === 'TSTypeReference' ? reference.typeName : reference.expression;
	return parent.type === 'TSTypeParameterInstantiation'
		&& [ 'TSTypeReference', 'TSInterfaceHeritage' ].includes( reference.type )
		&& name?.type === 'Identifier'
		&& [ 'Pick', 'Omit' ].includes( name.name ) && parent.params[ 1 ] === node;
}

/**
 * Enforces owned constant-object definitions and typed consumers, including tests and JSX.
 * @since 0.1.0
 */
export default {
	meta: {
		type: 'problem',
		docs: { description: 'Use named constant objects and infer finite-domain types from them.' },
		schema: [],
		messages: {
			declaration: 'Define a constant object in the owning types module and infer this finite-domain type from it.',
			reference: 'Use {{reference}} instead of repeating its raw value. This convention also applies to tests.',
		},
	},
	/**
	 * Builds typed visitors for owned finite domains.
	 * @param {import('eslint').Rule.RuleContext} context Active source and reporting context.
	 * @return {import('eslint').Rule.RuleListener} Declaration and consumer checks.
	 */
	create( context ) {
		const services = context.sourceCode.parserServices;
		const checker = services.program.getTypeChecker();
		/**
		 * Checks all literal expression syntaxes against owned contextual domains.
		 * @param {import('@typescript-eslint/types').TSESTree.Node} node Literal consumer.
		 */
		function checkLiteral( node ) {
			const source = services.esTreeNodeToTSNodeMap.get( node );
			const value = literalValue( source );
			if ( value === undefined
				|| ( ! ts.isExpressionNode( source ) && ! ts.isJsxAttribute( source.parent ) ) ) {
				return;
			}
			const types = [
				{ type: checker.getContextualType( source ), inferred: ! externalContext( source, checker ) },
				{ type: matcherType( source, checker ), inferred: true },
			];
			if ( ts.isBinaryExpression( source.parent ) ) {
				const other = source.parent.left === source ? source.parent.right : source.parent.left;
				types.push( {
					type: checker.getTypeAtLocation( other ), inferred: ! externalContext( other, checker ),
				} );
			}
			if ( ts.isCaseClause( source.parent ) ) {
				const switched = source.parent.parent.parent.expression;
				types.push( {
					type: checker.getTypeAtLocation( switched ), inferred: ! externalContext( switched, checker ),
				} );
			}
			for ( const candidate of types ) {
				const reference = constantReference(
					candidate.type, value, context.sourceCode.getScope( node ), services.program, candidate.inferred,
				);
				if ( reference ) {
					context.report( { node, messageId: 'reference', data: { reference } } );
					return;
				}
			}
		}
		return {
			/**
			 * Rejects duplicate finite-domain declarations without a runtime object.
			 * @param {import('@typescript-eslint/types').TSESTree.TSUnionType} node Declared union.
			 */
			TSUnionType( node ) {
				const literals = node.types.filter( ( type ) => type.type === 'TSLiteralType'
					&& literalValue( services.esTreeNodeToTSNodeMap.get( type.literal ) ) !== undefined );
				if ( literals.length > 1 && ! isKeySelection( node ) ) {
					context.report( { node, messageId: 'declaration' } );
				}
			},
			Literal: checkLiteral,
			TemplateLiteral: checkLiteral,
			UnaryExpression: checkLiteral,
		};
	},
};
