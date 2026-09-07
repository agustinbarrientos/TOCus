import { Button, Icon, IconName, Menu } from '@tocus/ui';
import type { LanguageMenuProps } from './types';

/**
 * Opens languages next to the initiating control; Mantine manages keyboard focus.
 * @param props - Current locale and localized routes.
 * @return Header-local language menu.
 * @since 0.1.0
 */
export function LanguageMenu( props: LanguageMenuProps ) {
	const { localization, localizations } = props;
	const { catalog } = localization;
	const current = catalog.languageLabels[ localization.language ];
	return <Menu position="bottom-end" withinPortal={ false } shadow="md" width="auto">
		<Menu.Target>
			<Button variant="subtle" className="language-shortcut"
				aria-label={ `${ catalog.languageMenuLabel }: ${ current }` }
				leftSection={ <Icon name={ IconName.LETTERS } /> }>
				{ current }
			</Button>
		</Menu.Target>
		<Menu.Dropdown className="website-language-menu">
			{ localizations.map( ( option ) => <Menu.Item key={ option.language } component="a"
				href={ option.path } lang={ option.languageTag }
				aria-current={ option.language === localization.language ? 'page' : undefined }
				rightSection={ option.language === localization.language
					? <Icon name={ IconName.CIRCLE_CHECK } /> : null }>
				{ catalog.languageLabels[ option.language ] }
			</Menu.Item> ) }
		</Menu.Dropdown>
	</Menu>;
}
