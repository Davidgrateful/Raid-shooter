'use client';

import { Bay3D } from '@/components/three/Bay3D';
import { BayViewport, type BayViewportProps } from './BayViewport';

/**
 * The bay every screen uses (hangar, armory, pre-flight): the 3D bay when this
 * browser can run it, the 2D bay while it loads and wherever it can't.
 */
export function BayView(props: BayViewportProps) {
  return (
    <Bay3D
      mode="bay"
      ship={props.ship}
      color={props.color}
      accentHue={props.accentHue}
      trailHue={props.trailHue}
      drone={props.drone}
      unlocked={props.unlocked}
      swapKey={props.swapKey}
      swapDir={props.swapDir}
      compact={props.compact}
      subject={props.subject}
      label={props.ship ? `${props.ship.title} on the hangar turntable. Drag to spin it.` : undefined}
      fallback={<BayViewport {...props} />}
    />
  );
}
