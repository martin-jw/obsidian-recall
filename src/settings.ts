import { Modal, App, Setting, Notice, PluginSettingTab, ButtonComponent, DropdownComponent } from "obsidian";
import ObsidianSrsPlugin from "./main";

import SrsAlgorithm from "./algorithms";
import { LeitnerAlgorithm } from "./algorithms/leitner";
import { Sm2Algorithm } from "./algorithms/supermemo";
import { AnkiAlgorithm } from "./algorithms/anki";
import { SelectorType, ItemSelector } from "./selection";

import ConfirmModal from "./modals/confirm";

export const algorithms: Record<string, SrsAlgorithm> = {
    Anki: new AnkiAlgorithm(),
    SM2: new Sm2Algorithm(),
    Leitner: new LeitnerAlgorithm(),
};

export enum DataLocation {
    PluginFolder = "In Plugin Folder",
    RootFolder = "In Vault Folder"
}

const locationMap: Record<string, DataLocation> = {
    "In Vault Folder": DataLocation.RootFolder,
    "In Plugin Folder": DataLocation.PluginFolder,
};


export interface SrsPluginSettings {
    maxNewPerDay: number;
    repeatItems: boolean;
    shuffleQueue: boolean;
    dataLocation: DataLocation;
    locationPath: string;
    algorithm: string;
    algorithmSettings: any;
    itemSelectors: ItemSelector[];
}

export const DEFAULT_SETTINGS: SrsPluginSettings = {
    maxNewPerDay: 20,
    repeatItems: true,
    shuffleQueue: true,
    dataLocation: DataLocation.RootFolder,
    locationPath: "",
    algorithm: Object.keys(algorithms)[0],
    algorithmSettings: Object.values(algorithms)[0].settings,
    itemSelectors: [],
};

export default class SrsSettingTab extends PluginSettingTab {
    plugin: ObsidianSrsPlugin;

    constructor(app: App, plugin: ObsidianSrsPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const plugin = this.plugin;
        let { containerEl } = this;

        containerEl.empty();

        this.addNewPerDaySetting(containerEl);
        this.addRepeatItemsSetting(containerEl);
        this.addShuffleSetting(containerEl);
        this.addDataLocationSettings(containerEl);
        this.addItemSelectionSetting(containerEl);
        this.addAlgorithmSetting(containerEl);

        containerEl.createEl("h1").innerText = "Algorithm Settings";

        // Add algorithm specific settings
        plugin.algorithm.displaySettings(containerEl, (settings: any) => {
            plugin.settings.algorithmSettings = settings;
            plugin.saveData(plugin.settings);
        });
    }

    addDataLocationSettings(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName("Data Location")
            .setDesc("Where to store the data file for spaced repetition items.")
            .addDropdown((dropdown) => {
                Object.values(DataLocation).forEach((val) => {
                    dropdown.addOption(val, val);
                })
                dropdown.setValue(plugin.settings.dataLocation);

                dropdown.onChange((val) => {
                    const loc = locationMap[val];
                    plugin.settings.dataLocation = loc;
                    plugin.store.moveStoreLocation();
                    plugin.saveData(plugin.settings);
                });
            });
    }

    addRepeatItemsSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;
        new Setting(containerEl)
            .setName("Repeat Items")
            .setDesc(
                "Should items marked as incorrect be repeated until correct?"
            )
            .addToggle((toggle) => {
                toggle.setValue(plugin.settings.repeatItems);
                toggle.onChange((value) => {
                    plugin.settings.repeatItems = value;
                    plugin.saveData(plugin.settings);
                });
            });
    }

    addAlgorithmSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName("Algorithm")
            .addDropdown((dropdown) => {
                Object.keys(algorithms).forEach((val) => {
                    dropdown.addOption(val, val);
                });
                dropdown.setValue(plugin.settings.algorithm);
                dropdown.onChange((newValue) => {
                    if (newValue != plugin.settings.algorithm) {
                        new ConfirmModal(
                            plugin.app,
                            `Switching algorithms might reset or impact review timings on existing items.
                            This change is irreversible. Changing algorithms only takes effect after a restart
                            or a plugin reload. Are you sure you want to switch algorithms?
                            `,
                            (confirmed) => {
                                if (confirmed) {
                                    plugin.settings.algorithm = newValue;
                                    plugin.saveData(plugin.settings);
                                } else {
                                    dropdown.setValue(
                                        plugin.settings.algorithm
                                    );
                                }
                            }
                        ).open();
                    }
                });
            })
            .settingEl.querySelector(".setting-item-description").innerHTML =
            'The algorithm used for spaced repetition. For more information see <a href="https://github.com/martin-jw/obsidian-recall">algorithms</a>.';
    }

    addNewPerDaySetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName("New Per Day")
            .setDesc(
                "Maximum number of new (unreviewed) notes to add to the queue each day."
            )
            .addText((text) =>
                text
                    .setPlaceholder("New Per Day")
                    .setValue(plugin.settings.maxNewPerDay.toString())
                    .onChange((newValue) => {
                        let newPerDay = Number(newValue);

                        if (isNaN(newPerDay)) {
                            new Notice("Timeout must be a number");
                            return;
                        }

                        if (newPerDay < -1) {
                            new Notice("New per day must be -1 or greater.");
                            return;
                        }

                        plugin.settings.maxNewPerDay = newPerDay;
                        plugin.saveData(plugin.settings);
                    })
            );
    }

    addShuffleSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName("Shuffle Queue")
            .setDesc(
                "Whether or not the review queue order should be shuffled. If not the queue is in the order the items where added to the SRS.")
            .addToggle((toggle) => {
                toggle.setValue(plugin.settings.shuffleQueue)
                .onChange((newValue) => {
                    plugin.settings.shuffleQueue = newValue;
                    plugin.saveData(plugin.settings);
                })
            });
    }

    addItemSelectionSetting(containerEl: HTMLElement) {
        const plugin = this.plugin;

        new Setting(containerEl)
            .setName("Item Settings")
            .setDesc("Settings for how to extract items from tracked notes.")
            .addButton((button) => {
                button.setButtonText("Open Settings");
                button.setCta();
                button.onClick((evt) => {
                    new ItemSettingsModal(this.app, this.plugin).open();
                });
            });
    }
}

class ItemSettingsModal extends Modal {
    private plugin: ObsidianSrsPlugin;
    private selectorList: SelectorSettings[];

    constructor(app: App, plugin: ObsidianSrsPlugin) {
        super(app);
        this.plugin = plugin;
    }

    onOpen() {
        let {titleEl, contentEl, plugin} = this;

        titleEl.createEl("h3").innerText = "Selector Settings";

        // TODO: Show all item selector settings
        this.selectorList = new Array<SelectorSettings>(plugin.settings.itemSelectors.length);
        plugin.settings.itemSelectors.forEach((selector, i) => {
            this.selectorList[i] = new SelectorSettings(contentEl, selector);
        });

        // TODO: Add button for adding item selector
        new ButtonComponent(contentEl)
            .setButtonText("Add Selector")
            .setCta();

        // TODO: Default behavior
    }

    onClose() {
        let {titleEl, contentEl} = this;
        contentEl.empty();
        titleEl.empty();
    }

}

class SelectorSettings {

    private parentEl: HTMLElement;
    private selector: ItemSelector;
    private mainDiv: HTMLDivElement;

    constructor(containerEl: HTMLElement, selector: ItemSelector) {
        this.parentEl = containerEl;
        this.selector = selector;
        this.mainDiv = this.parentEl.createDiv('selector-settings-div');
        this.build();
    }

    private build() {
        let {mainDiv} = this;

        mainDiv.empty();

        let paragraph = mainDiv.createEl('p');
        paragraph.innerText = "Select ";

        let selectorTypes: Record<string, SelectorType> = {
            "a single block": SelectorType.SingleBlock,
            "multiple blocks": SelectorType.MultipleBlocks,
        }

        let dropdown = new DropdownComponent(mainDiv);
        for (let key in selectorTypes) {
            let value = selectorTypes[key].toString();
            console.log("Added: ", value, ", ", key);
            dropdown.addOption(value, key);
        }
    }
}
