/** Fired by every editing element with the replacement value; parents listen directly, so it does not bubble. */
export class KobenValueChangeEvent<T = unknown> extends Event {
  static readonly TYPE = "koben-value-change";
  constructor(public readonly value: T) {
    super(KobenValueChangeEvent.TYPE, { bubbles: false, composed: false });
  }
}
