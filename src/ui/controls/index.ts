import type { ParamDef, ParamValue } from '../../params/types';
import { gradientControl } from './gradient';
import { imageControl } from './image';
import { numberControl } from './number';
import { boolControl, colorControl, selectControl, textControl, vec2Control } from './simple';
import type { ChangeHandler, Control } from './types';

export type { Control, ChangeHandler } from './types';

/** Widget factory: one entry per ParamDef type. */
export function createControl(def: ParamDef, value: ParamValue, onChange: ChangeHandler): Control {
  switch (def.type) {
    case 'float':
    case 'int':
      return numberControl(def, value, onChange);
    case 'bool':
      return boolControl(def, value, onChange);
    case 'color':
      return colorControl(def, value, onChange);
    case 'select':
      return selectControl(def, value, onChange);
    case 'vec2':
      return vec2Control(def, value, onChange);
    case 'text':
      return textControl(def, value, onChange);
    case 'gradient':
      return gradientControl(def, value, onChange);
    case 'image':
      return imageControl(def, value, onChange);
  }
}
