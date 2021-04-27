import ObsidianSrsPlugin from "./main";
import { ItemInfoModal } from "./modals/info";

export default class Commands {
    plugin: ObsidianSrsPlugin;

    constructor(plugin: ObsidianSrsPlugin) {
        this.plugin = plugin;
    }

    addCommands() {
        const plugin = this.plugin;

        // plugin.addCommand({
        //     id: "view-item-info",
        //     name: "Item Info",
        //     checkCallback: (checking: boolean) => {
        //         let file = plugin.app.workspace.getActiveFile();
        //         if (file) {
        //             if (plugin.store.isTracked(file.path)) {
        //                 if (!checking) {
        //                     new ItemInfoModal(plugin, file).open();
        //                 }
        //                 return true;
        //             }
        //         }
        //         return false;
        //     },
        // });

        plugin.addCommand({
            id: "track-file",
            name: "Track Note",
            checkCallback: (checking: boolean) => {
                let file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (!plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.trackFile(file.path);
                            plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "untrack-file",
            name: "Untrack Note",
            checkCallback: (checking: boolean) => {
                let file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.untrackFile(file.path);
                            plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "update-file",
            name: "Update Note",
            checkCallback: (checking: boolean) => {
                let file = plugin.app.workspace.getActiveFile();
                if (file != null) {
                    if (plugin.store.isTracked(file.path)) {
                        if (!checking) {
                            plugin.store.updateItems(file.path);
                            plugin.updateStatusBar();
                        }
                        return true;
                    }
                }
                return false;
            },
        });

        plugin.addCommand({
            id: "build-queue",
            name: "Build Queue",
            callback: () => {
                plugin.store.buildQueue();
            },
        });

        plugin.addCommand({
            id: "review-view",
            name: "Review",
            callback: () => {
                plugin.store.buildQueue();
                const item = plugin.store.getNext();
                const state: any = { mode: "empty" };
                if (item != null) {
                    const path = plugin.store.getFilePath(item);
                    if (path != null) {
                        state.file = path;
                        state.item = plugin.store.getNextId();
                        state.mode = "question";
                    }
                }
                const leaf = plugin.app.workspace.getUnpinnedLeaf();
                leaf.setViewState({
                    type: "store-review-view",
                    state: state,
                });
                leaf.setPinned(true);
                plugin.app.workspace.setActiveLeaf(leaf);
            },
        });
    }

    addDebugCommands() {
        console.log("Injecting debug commands...");
        const plugin = this.plugin;

        plugin.addCommand({
            id: "debug-print-view-state",
            name: "Print View State",
            callback: () => {
                console.log(plugin.app.workspace.activeLeaf.getViewState());
            },
        });

        plugin.addCommand({
            id: "debug-print-eph-state",
            name: "Print Ephemeral State",
            callback: () => {
                console.log(
                    plugin.app.workspace.activeLeaf.getEphemeralState()
                );
            },
        });

        plugin.addCommand({
            id: "debug-print-queue",
            name: "Print Queue",
            callback: () => {
                console.log(plugin.store.data.queue);
                console.log(
                    "There are " +
                        plugin.store.data.queue.length +
                        " items in queue."
                );
                console.log(
                    plugin.store.data.newAdded + " new where added to today."
                );
            },
        });

        plugin.addCommand({
            id: "debug-clear-queue",
            name: "Clear Queue",
            callback: () => {
                plugin.store.data.queue = [];
            },
        });

        plugin.addCommand({
            id: "debug-queue-all",
            name: "Queue All",
            callback: () => {
                plugin.store.data.queue = [];
                for (let i = 0; i < plugin.store.data.items.length; i++) {
                    if (plugin.store.data.items[i] != null) {
                        plugin.store.data.queue.push(i);
                    }
                }
                console.log("Queue Size: " + plugin.store.queueSize());
            },
        });

        plugin.addCommand({
            id: "debug-print-data",
            name: "Print Data",
            callback: () => {
                console.log(plugin.store.data);
            },
        });

        plugin.addCommand({
            id: "debug-reset-data",
            name: "Reset Data",
            callback: () => {
                console.log("Resetting data...");
                plugin.store.resetData();
                console.log(plugin.store.data);
            },
        });
    }
}
