import { TFolder, TFile, Plugin } from "obsidian";
import { DataStore } from "./data";
import { ReviewView } from "./view";
import SrsAlgorithm from "./algorithms";
import SrsSettingTab from "./settings";
import { SrsPluginSettings, DEFAULT_SETTINGS, algorithms } from "./settings";
import Commands from "./commands";
import { ItemSelector, MultipleBlockSelector, SingleBlockSelector, SelectorType } from './selection';

const DEBUG: boolean = true;

export default class ObsidianSrsPlugin extends Plugin {
    settings: SrsPluginSettings;
    store: DataStore;
    algorithm: SrsAlgorithm;

    commands: Commands;

    barItem: HTMLElement;

    async onload() {
        console.log("Loading Obsidian Recall...");
        if (DEBUG) console.log("DEBUG");

        await this.loadSettings();

        this.algorithm = algorithms[this.settings.algorithm];
        this.algorithm.updateSettings(this.settings.algorithmSettings);

        this.store = new DataStore(this);
        await this.store.load();
        this.store.buildQueue();

        this.commands = new Commands(this);
        this.commands.addCommands();
        if (DEBUG) {
            this.commands.addDebugCommands();
        }

        this.barItem = this.addStatusBarItem();
        this.updateStatusBar();

        this.addSettingTab(new SrsSettingTab(this.app, this));

        this.registerEvents();

        this.registerView("store-review-view", (leaf) => {
            return new ReviewView(leaf, this);
        });

        this.registerInterval(
            window.setInterval(() => this.store.save(), 5 * 60 * 1000)
        );
    }

    onunload() {
        console.log("Unloading Obsidian Recall. Saving tracked files...");
        this.store.save();
    }

    async loadSettings() {
        this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());

        // Cast selectors to actual selector instances for suitable methods.
        // There's probably some better way to do this, maybe?
        let selectors: ItemSelector[] = [];
        this.settings.itemSelectors.forEach((selector) => {
            switch (<SelectorType>selector.selectorType) {
                case SelectorType.MultipleBlocks: {
                    selectors.push(Object.assign(new MultipleBlockSelector(), selector));
                    break;
                }
                case SelectorType.SingleBlock: {
                    selectors.push(Object.assign(new SingleBlockSelector(), selector));
                    break;
                }
            }
        });

        this.settings.itemSelectors = selectors;
        if (DEBUG) {
            console.log("Loaded settings: ", this.settings);
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    updateStatusBar() {
        let view = this.app.workspace.getActiveViewOfType(ReviewView);
        this.barItem.removeClasses(["srs-bar-tracked"]);
        if (view) {
            let text =
                "Remaining: " +
                (this.store.queueSize() + this.store.repeatQueueSize());

            this.barItem.setText(text);
        } else {
            let file = this.app.workspace.getActiveFile();
            let text = "Queue: " + this.store.queueSize();

            if (file == null) {
                this.barItem.setText(text);
            } else {
                if (this.store.isTracked(file.path)) {
                    const items = this.store.getItemsOfFile(file.path);
                    let mostRecent = Number.MAX_SAFE_INTEGER;
                    items.forEach((item) => {
                        if (item.nextReview < mostRecent) {
                            mostRecent = item.nextReview;
                        }
                    });

                    const now = new Date();
                    let diff = (mostRecent - now.getTime()) / (1000 * 60 * 60);
                    if (diff <= 0) {
                        text = "Next Review: Now!";
                    } else {
                        if (diff >= 24) {
                            diff /= 24;
                            text = "Next Review: " + diff.toFixed(1) + " days";
                        } else {
                            text = "Next Review: " + diff.toFixed(1) + " hours";
                        }
                    }

                    this.barItem.setText(text);
                    this.barItem.addClass("srs-bar-tracked");
                } else {
                    this.barItem.setText(text);
                }
            }
        }
    }

    registerEvents() {
        this.registerEvent(
            this.app.workspace.on("file-open", (f) => {
                this.updateStatusBar();
            })
        );

        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
                if (file instanceof TFolder) {
                    const folder = file as TFolder;

                    menu.addItem((item) => {
                        item.setIcon("plus-with-circle");
                        item.setTitle("Track All Notes");
                        item.onClick((evt) => {
                            this.store.trackFilesInFolder(folder);
                        });
                    });

                    menu.addItem((item) => {
                        item.setIcon("minus-with-circle");
                        item.setTitle("Untrack All Notes");
                        item.onClick((evt) => {
                            this.store.untrackFilesInFolder(folder);
                        });
                    });
                } else if (file instanceof TFile) {
                    if (this.store.isTracked(file.path)) {
                        menu.addItem((item) => {
                            item.setIcon("minus-with-circle");
                            item.setTitle("Untrack Note");
                            item.onClick((evt) => {
                                this.store.untrackFile(file.path);
                            });
                        });
                    } else {
                        menu.addItem((item) => {
                            item.setIcon("plus-with-circle");
                            item.setTitle("Track Note");
                            item.onClick((evt) => {
                                this.store.trackFile(file.path);
                            });
                        });
                    }
                }
            })
        );

        this.registerEvent(
            this.app.vault.on("rename", (file, old) => {
                this.store.renameTrackedFile(old, file.path);
            })
        );

        this.registerEvent(
            this.app.vault.on("delete", (file) => {
                this.store.untrackFile(file.path);
            })
        );
    }
}
