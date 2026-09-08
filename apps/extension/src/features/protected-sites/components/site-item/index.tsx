import {
	Avatar,
	Alert,
	Badge,
	Button,
	Group,
	Stack,
	TextInput,
	Icon,
	IconName,
} from '@tocus/ui';
import {
	DefaultProtectionScopeId,
} from '../../../../domains/protection/types/protection-value';
import {
	resolveSiteDisplayIdentity,
} from '../../utils/site-display-name-resolver';
import {
	SiteBehavior,
} from '../site-behavior';
import type {
	WebsiteItemProps,
} from './types';
import './style.scss';
import { Feedback } from '../../../settings/components/feedback';
import { ProtectedSiteItemOperationErrorReason } from './types';
import { useEffect, useRef, type SubmitEvent } from 'react';


/**
 * Presents a website identity, its timing scope, and accessible editing or access-recovery actions.
 * @param props - Controlled website values, current access and explicit row actions.
 * @return Website identity, denied-access recovery and optional draft editor.
 * @since 0.1.0
 */
export function WebsiteItem( props: WebsiteItemProps ) {
	const { site, copy, disabled } = props;
	const nameInput = useRef<HTMLInputElement>( null );
	useEffect( () => {
		if ( props.editing ) {
			nameInput.current?.focus();
		}
	}, [ props.editing ] );
	const identity = resolveSiteDisplayIdentity( site );
	const storedIndependent = site.rule.scopeId !== DefaultProtectionScopeId;
	const independent = props.persistedEditing?.state.independent ?? storedIndependent;
	const displayName = props.persistedEditing?.state.displayName ?? site.displayNameOverride ?? '';
	const error = props.persistedEditing?.state.error;
	/**
	 * Completes the current editor through its existing owner without duplicating persistence.
	 * @param event - Native form submission from Enter or the primary action.
	 */
	function submitEditor( event: SubmitEvent<HTMLFormElement> ): void {
		event.preventDefault();
		if ( disabled ) {
			return;
		}
		const submit = props.persistedEditing?.save ?? props.onDone ?? props.onEdit;
		submit();
	}
	return (
		<li className="settings-site-item">
			<Stack gap={ 0 }>
				<Group className="settings-site-row" wrap="nowrap" gap="var(--tocus-space-3)">
					<Avatar className="tocus-native-avatar" src={ props.favicon }
						size="2.75rem" radius="var(--tocus-radius-small)" aria-hidden="true">
						<span className="settings-site-monogram">{ identity.monogram }</span>
					</Avatar>
					<div className="settings-site-identity">
						<h2>{ identity.name }</h2>
						<p>{ site.rule.host }</p>
					</div>
					<Badge className="settings-site-scope">{ storedIndependent ? copy.independentLabel : copy.sharedLabel }</Badge>
					<Button className="tocus-native-button" variant="outline" disabled={ disabled } onClick={ props.onEdit }>
						{ copy.edit }
					</Button>
				</Group>
				<p className="settings-site-boundary">{ copy.formatBoundary( site.rule.host, site.rule.includeSubdomains ) }</p>
				{ props.confirmation }
				{ props.accessRequired && <Alert role="status" color="yellow" className="settings-site-access"
					icon={ <Icon name={ IconName.EXCLAMATION } /> } styles={ {
						wrapper: { justifyContent: 'space-between' }, body: { display: 'contents' },
						message: { display: 'contents' }, icon: { marginInlineEnd: 0 },
					} }>
					<span>{ copy.accessRequired }</span>
					<Button className="tocus-native-button" variant="outline" disabled={ props.accessDisabled } onClick={ props.onGrant }>
						{ props.accessPending ? copy.allowingAccess : copy.allowAccess }
					</Button>
				</Alert> }
				{ props.editing && <form className="settings-site-editor" onSubmit={ submitEditor }>
					<label htmlFor={ `site-name-${ site.identityHost }` }>{ copy.displayNameLabel }</label>
					<Group className="settings-site-name-control" wrap="nowrap" gap="var(--tocus-space-3)">
						<TextInput className="tocus-native-field" ref={ nameInput } id={ `site-name-${ site.identityHost }` } value={ displayName }
							classNames={ { input: 'settings-native-input' } }
							placeholder={ identity.name } maxLength={ 80 } disabled={ disabled }
							onChange={ ( event ) => {
								props.onChange( event.currentTarget.value, independent );
							} } />
						<Button className="tocus-native-button" variant="outline" disabled={ disabled }
							onClick={ () => {
								props.onChange( '', independent );
								nameInput.current?.focus();
							} }>{ copy.useAutomaticName }</Button>
					</Group>
					<SiteBehavior stacked copy={ copy } name={ `behavior-${ site.identityHost }` }
						independent={ independent } disabled={ disabled }
						onChange={ ( separate ) => {
							props.onChange( displayName, separate );
						} } />
					{ error && <div className="settings-site-feedback">
						<Feedback nativeError className="tocus-notice-paragraph" error={ error === ProtectedSiteItemOperationErrorReason.CONFIGURATION_CHANGED
							? copy.configurationChangedError : copy.operationError } />
					</div> }
					<Group className="settings-site-editor-footer" justify="space-between" gap="var(--tocus-space-2)">
						<Button className="tocus-native-button" color="red"
							disabled={ disabled } onClick={ props.onRemove }>{ copy.removeSite }</Button>
						<Group className="tocus-form-actions settings-site-edit-actions" gap="var(--tocus-space-2)">
							{ props.persistedEditing && <Button className="tocus-native-button" variant="outline" disabled={ disabled }
								onClick={ props.persistedEditing.cancel }>{ copy.cancel }</Button> }
							<Button className="tocus-native-button" type="submit" disabled={ disabled }>
								{ props.persistedEditing ? copy.saveChanges : copy.done }
							</Button>
						</Group>
					</Group>
				</form> }
			</Stack>
		</li>
	);
}
