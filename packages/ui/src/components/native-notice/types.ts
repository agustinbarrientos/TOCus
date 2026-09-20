import type { AriaRole } from 'react';
import type { AlertProps } from '@mantine/core';
import type { IconName } from '../icon/types';

/**
 * Text-only native notice composition; richer alerts keep Mantine's ordinary slots.
 * @since 0.1.0
 */
export interface NativeNoticeProps {
	message: string;
	icon: IconName;
	color?: AlertProps['color'];
	role?: AriaRole;
	className?: string;
}
