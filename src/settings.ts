import { App, Setting, Notice, PluginSettingTab } from "obsidian";
import ObsidianSrsPlugin from "./main";

import SrsAlgorithm from "./algorithms";
import { LeitnerAlgorithm } from "./algorithms/leitner";
import { Sm2Algorithm } from "./algorithms/supermemo";
import { AnkiAlgorithm } from "./algorithms/anki";

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
    dataLocation: DataLocation;
    locationPath: string;
    algorithm: string;
    algorithmSettings: any;
}

export const DEFAULT_SETTINGS: SrsPluginSettings = {
    maxNewPerDay: 20,
    repeatItems: true,
    dataLocation: DataLocation.PluginFolder,
    locationPath: "",
    algorithm: Object.keys(algorithms)[0],
    algorithmSettings: Object.values(algorithms)[0].settings,
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
        this.addDataLocationSettings(containerEl);
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
                dropdown.setValue(plugin.settings.dataLocation);
                Object.keys(DataLocation).forEach((val) => {
                    dropdown.addOption(val, DataLocation[val as keyof typeof DataLocation]);
                })

                console.log(plugin.settings.dataLocation);
                dropdown.onChange((val) => {
                    const loc = DataLocation[val as keyof typeof DataLocation];
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
            'The algorithm used for spaced repetition. For more information see <a href="https://github.com/martin-jw/obsidian-srs">algorithms</a>.';
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
}
