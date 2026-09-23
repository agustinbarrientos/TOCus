import '@webcomponents/custom-elements';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { mountProtectedPageLayer } from '../../features/interruption/services/protected-page';

/**
 * Protected-page script mounted by the browser runtime.
 * @since 1.0.0 Initial implementation.
 */
export default defineUnlistedScript( { main: mountProtectedPageLayer } );
