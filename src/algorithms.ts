import { RepetitionItem, ReviewResult } from "./data";
import { ObjectUtils } from "./utils";

export default abstract class SrsAlgorithm {
    settings: any;

    updateSettings(settings: any) {
        this.settings = ObjectUtils.assignOnly(
            this.defaultSettings(),
            settings
        );
    }

    abstract defaultSettings(): any;
    abstract defaultData(): any;
    abstract onSelection(
        item: RepetitionItem,
        option: string,
        repeat: boolean
    ): ReviewResult;
    abstract srsOptions(): String[];
    abstract displaySettings(
        containerEl: HTMLElement,
        update: (settings: any) => void
    ): void;
}
