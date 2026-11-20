import type { ParamValue } from '../../params/types';

/** A widget editing one parameter value. The panel owns label/row layout. */
export interface Control {
  readonly element: HTMLElement;
  /** Updates the widget without emitting a change. */
  setValue(value: ParamValue): void;
}

export type ChangeHandler = (value: ParamValue) => void;
