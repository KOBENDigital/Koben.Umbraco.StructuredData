import { UmbModalToken } from "@umbraco-cms/backoffice/modal";
import { STRUCTURED_DATA_TYPE_PICKER_MODAL_ALIAS } from "../constants.js";

export interface KobenTypePickerModalData {
  /** Catalogue aliases the data type allows; empty means all. */
  allowedTypes: string[];
  allowCustomJson: boolean;
}

export interface KobenTypePickerModalValue {
  type: string;
}

export const KOBEN_TYPE_PICKER_MODAL = new UmbModalToken<KobenTypePickerModalData, KobenTypePickerModalValue>(
  STRUCTURED_DATA_TYPE_PICKER_MODAL_ALIAS,
  {
    modal: {
      type: "sidebar",
      size: "medium",
    },
  },
);
