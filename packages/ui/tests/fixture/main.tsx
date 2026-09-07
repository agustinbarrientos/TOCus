import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Alert, Avatar, Brand, Button, Checkbox, Icon, IconName, Modal, NavLink, Portal, Radio, Select, Slider, Stack, Stepper, TextInput, Title, TocusProvider, TocusAppearance, TocusPalette } from '../../src';
import avatarImage from '../../../theme/assets/icon.svg?url';
import '../../src/styles.scss';
import { FixtureChoice, FixtureFrequency, FixtureMediaMode } from './types';
import { NativeNotice } from '../../src';

/**
 * Public consumer fixture for provider and theme regressions.
 * @return Real themed form and dialog.
 */
function Fixture() {
	const [ wait, setWait ] = useState( 10 );
	const [ open, setOpen ] = useState( false );
	const [ result, setResult ] = useState( '' );
	const [ activations, setActivations ] = useState( 0 );
	const query = new URLSearchParams( location.search );
	const selectedPalette = query.get( 'palette' );
	const palette = Object.values( TocusPalette ).find( ( candidate ) => candidate === selectedPalette )
		?? TocusPalette.BROWN;
	const appearance = Object.values( TocusAppearance ).find( ( candidate ) => candidate === query.get( 'appearance' ) )
		?? TocusAppearance.LIGHT;
	return <><TocusProvider appearance={appearance} palette={palette}>
		<div className="tocus-page" data-testid="main-provider">
			<Brand /><Title order={ 1 } tabIndex={ -1 }>Controls</Title>
			<form onSubmit={( event ) => {
				event.preventDefault(); const data = new FormData( event.currentTarget );
				setResult( [ 'wait', 'media', 'enabled', 'frequency', 'title' ].map( ( name ) => {
					const value = data.get( name );
					return typeof value === 'string' ? value : '';
				} ).join( ' / ' ) );
			}}>
				<div className="tocus-section">
					<TextInput className="tocus-native-field" label="Title" name="title" defaultValue="Focus" />
					<TextInput label="Default field" />
					<TextInput className="tocus-native-field" label="Adorned field" leftSection={ <span aria-hidden="true">@</span> }
						rightSection={ <span aria-hidden="true">#</span> } />
					<label id="wait-label">Initial wait</label>
					<Slider name="wait" thumbLabel="Initial wait" min={10} max={30} step={5} value={wait} onChange={setWait} />
					<Radio.Group name="media" defaultValue={FixtureMediaMode.MUTE} label="Media">
						<Radio value={FixtureMediaMode.MUTE} label="Mute media" />
						<Radio value={FixtureMediaMode.PAUSE} label="Pause media" />
					</Radio.Group>
					<Radio.Group name="choice" defaultValue={FixtureChoice.FIRST} label="Layout choices">
						<Radio.Card className="tocus-choice-card" value={FixtureChoice.FIRST} aria-label="First choice" p="md">
							<Radio.Indicator /> First choice
						</Radio.Card>
						<Radio.Card className="tocus-choice-card" value={FixtureChoice.SECOND} aria-label="Second choice" p="md">
							<Radio.Indicator /> Second choice
						</Radio.Card>
					</Radio.Group>
					<Checkbox className="tocus-native-checkbox" name="enabled" value="yes" label="Enabled" />
					<Radio.Group defaultValue={ FixtureChoice.FIRST } label="Native row choices">
						<Radio className="tocus-choice-card tocus-choice-radio" value={ FixtureChoice.FIRST }
							label="Native first" description="First explanation" />
						<Radio className="tocus-choice-card tocus-choice-radio" value={ FixtureChoice.SECOND }
							label="Native second" description="Second explanation" />
					</Radio.Group>
					<Select name="frequency" label="Frequency" defaultValue={FixtureFrequency.DAILY}
						data={[ { value: FixtureFrequency.DAILY, label: 'Daily' }, { value: FixtureFrequency.WEEKLY, label: 'Weekly' } ]} />
				</div>
				<div className="tocus-form-actions">
					<Button type="submit" data-contrast>Save</Button>
					<Button variant="outline" data-contrast>Discard</Button>
					<Button color="red" data-contrast>Delete</Button>
					<Button disabled data-contrast>Unavailable</Button>
					<Button component="a" href="#documentation" variant="subtle" rightSection={<Icon name={ IconName.ARROW_UP_RIGHT_FROM_SQUARE } />}>Documentation</Button>
				</div>
			</form>
			<output role="status">{result}</output>
			<Stack className="tocus-section" align="flex-start">
				<Button className="tocus-native-button" onClick={ () => {
					setActivations( ( count ) => count + 1 );
				} }>Native action</Button>
				<Button className="tocus-native-button" leftSection={ <Icon name={ IconName.HEART } /> }>Adorned action</Button>
				<Button className="tocus-native-button" loading>Loading action</Button>
				<Button className="tocus-native-button" disabled>Disabled native action</Button>
				<div aria-label="Native activation count">{ activations }</div>
				<Avatar className="tocus-native-avatar" size="2.75rem" role="img" aria-label="Native initials">TC</Avatar>
				<Avatar size="2.75rem" role="img" aria-label="Default initials">TC</Avatar>
				<Avatar className="tocus-native-avatar" size="2.75rem" src={ avatarImage } alt="Website icon" />
				<Avatar className="tocus-native-avatar" size="2.75rem" src="/missing-avatar.svg"
					role="img" aria-label="Unavailable website icon">TC</Avatar>
			</Stack>
			<NavLink active href="#current-page" label="Current page" data-contrast />
			<Stepper active={ 1 }>
				<Stepper.Step label="Previous step" completedIcon={ <Icon name={ IconName.CIRCLE_CHECK } /> } />
				<Stepper.Step label="Current step" disabled />
				<Stepper.Step label="Future step" disabled />
			</Stepper>
			<div className="tocus-section">
				<NativeNotice color="red" role="alert" icon={ IconName.EXCLAMATION }
					message="Native notice keeps localized feedback readable when the message wraps onto several lines." />
				<Alert color="red" icon={<Icon name={ IconName.EXCLAMATION } />} data-contrast>Could not save</Alert>
				<Alert color="green" icon={<Icon name={ IconName.CIRCLE_CHECK } />} role="note" data-contrast>Saved successfully</Alert>
				<Alert color="yellow" role="note" data-contrast>Review browser access</Alert>
				<div className="tocus-info" data-contrast>Stored on this device</div>
			</div>
			<Button onClick={() => {
				setOpen( true );
			}}>Review changes</Button>
			<Modal opened={open} onClose={() => {
				setOpen( false );
			}} title="Review">
				<TextInput label="Review note" data-autofocus /><Button onClick={() => {
					setOpen( false );
				}}>Done</Button>
			</Modal>
		</div>
	</TocusProvider><TocusProvider appearance={TocusAppearance.DARK} palette={TocusPalette.BLUE} compact transparent>
		<Button>Compact action</Button></TocusProvider></>;
}

const main = document.querySelector( 'main' );
if ( ! main ) {
	throw new Error( 'Missing fixture mount' );
}
/**
 * Public supplied-root portal and cleanup fixture.
 * @return An unmountable owned provider.
 */
function OwnershipFixture() {
	const [ mounted, setMounted ] = useState( true );
	const root = document.getElementById( 'owned-root' );
	const portalTarget = document.getElementById( 'owned-portals' );
	if ( ! root || ! portalTarget ) {
		throw new Error( 'Missing owned fixture roots' );
	}
	return <><button onClick={() => {
		setMounted( false );
	}}>Unmount integration</button>
	{mounted && <TocusProvider appearance={TocusAppearance.DARK} palette={TocusPalette.PINK} {...( new URLSearchParams( location.search ).has( 'target-only' ) ? {} : { root } )} portalTarget={portalTarget}>
		<Portal><Button>Owned action</Button><TextInput label="Owned field" /></Portal>
	</TocusProvider>}</>;
}

createRoot( main ).render( new URLSearchParams( location.search ).has( 'ownership' ) ? <OwnershipFixture /> : <Fixture /> );
