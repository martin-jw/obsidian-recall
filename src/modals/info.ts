import { Modal, TFile } from "obsidian";
import ObsidianSrsPlugin from "src/main";
import { DataStore } from "../data";

export class ItemInfoModal extends Modal {
    plugin: ObsidianSrsPlugin;
    file: TFile;

    constructor(plugin: ObsidianSrsPlugin, file: TFile) {
        super(plugin.app);
        this.plugin = plugin;
        this.file = file;
    }

    onOpen() {
        const { contentEl, plugin } = this;
        //TODO: Implement Item info.
    }

    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}
