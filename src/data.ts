import ObsidianSrsPlugin from "./main";
import { DateUtils } from "./utils";

import { TFile, TFolder, Notice } from "obsidian";

const DEFAULT_DATA_PATH: string = "./tracked_files.json";

interface SrsData {
    queue: number[];
    repeatQueue: number[];
    items: RepetitionItem[];
    trackedFiles: TrackedFile[];
    lastQueue: number;
    newAdded: 0;
}

export interface RepetitionItem {
    nextReview: number;
    fileIndex: number;
    timesReviewed: number;
    timesCorrect: number;
    errorStreak: number; // Needed to calculate leeches later on.
    data: any; // Additional data, determined by the selected algorithm.
}

interface TrackedFile {
    path: string;
    items: Record<string, number>;
}

export interface ReviewResult {
    correct: boolean;
    nextReview: number;
}

const DEFAULT_SRS_DATA: SrsData = {
    queue: [],
    repeatQueue: [],
    items: [],
    trackedFiles: [],
    lastQueue: 0,
    newAdded: 0,
};

const NEW_ITEM: RepetitionItem = {
    nextReview: 0,
    fileIndex: -1,
    timesReviewed: 0,
    timesCorrect: 0,
    errorStreak: 0,
    data: {},
};

export class DataStore {
    data: SrsData;
    plugin: ObsidianSrsPlugin;
    dataPath: string;

    constructor(plugin: ObsidianSrsPlugin, path?: string) {
        this.plugin = plugin;
        if (path != null) {
            this.dataPath = path;
        } else {
            this.dataPath = DEFAULT_DATA_PATH;
        }
    }

    async load() {
        let adapter = this.plugin.app.vault.adapter;

        if (await adapter.exists(this.dataPath)) {
            let data = await adapter.read(this.dataPath);
            if (data == null) {
                console.log("Unable to read SRS data!");
                this.data = Object.assign({}, DEFAULT_SRS_DATA);
            } else {
                console.log("Reading tracked files...");
                this.data = Object.assign(
                    Object.assign({}, DEFAULT_SRS_DATA),
                    JSON.parse(data)
                );
            }
        } else {
            console.log("Tracked files not found! Creating new file...");
            this.data = Object.assign({}, DEFAULT_SRS_DATA);
            await this.plugin.app.vault.adapter.write(
                this.dataPath,
                JSON.stringify(this.data)
            );
        }
    }

    async save() {
        await this.plugin.app.vault.adapter.write(
            this.dataPath,
            JSON.stringify(this.data)
        );
    }

    /**
     * Returns total number of items tracked by the SRS.
     */
    items(): number {
        return this.data.items.length;
    }

    /**
     * Returns the size of the current queue.
     */
    queueSize(): number {
        return this.data.queue.length;
    }

    repeatQueueSize(): number {
        return this.data.repeatQueue.length;
    }

    getFileIndex(path: string): number {
        return this.data.trackedFiles.findIndex((val, ind, obj) => {
            return val != null && val.path == path;
        });
    }

    /**
     * Returns whether or not the given file path is tracked by the SRS.
     * @param path The path of the file.
     */
    isTracked(path: string): boolean {
        return this.getFileIndex(path) >= 0;
    }

    isQueued(item: number): boolean {
        return this.data.queue.includes(item);
    }

    isInRepeatQueue(item: number): boolean {
        return this.data.repeatQueue.includes(item);
    }

    /**
     * Returns when the given item is reviewed next (in hours).
     */
    nextReview(itemId: number): number {
        const item = this.data.items[itemId];
        if (item == null) {
            return -1;
        }

        const now: Date = new Date();
        return (item.nextReview - now.getTime()) / (1000 * 60 * 60);
    }

    getItemsOfFile(path: string): RepetitionItem[] {
        let result: RepetitionItem[] = [];
        const file = this.data.trackedFiles[this.getFileIndex(path)];
        Object.values(file.items).forEach((item) => {
            result.push(this.data.items[item]);
        });
        return result;
    }

    getNext(): RepetitionItem | null {
        const id = this.getNextId();
        if (id != null) {
            return this.data.items[id];
        }

        return null;
    }

    getNextId(): number | null {
        if (this.queueSize() > 0) {
            return this.data.queue[0];
        } else if (this.data.repeatQueue.length > 0) {
            return this.data.repeatQueue[0];
        } else {
            return null;
        }
    }

    getFilePath(item: RepetitionItem): string | null {
        return this.data.trackedFiles[item.fileIndex].path;
    }

    reviewId(itemId: number, option: string) {
        const item = this.data.items[itemId];
        if (item == null) {
            return -1;
        }

        if (this.isInRepeatQueue(itemId)) {
            let result = this.plugin.algorithm.onSelection(item, option, true);

            this.data.repeatQueue.remove(itemId);
            if (!result.correct) {
                this.data.repeatQueue.push(itemId); // Re-add until correct.
            }
        } else {
            let result = this.plugin.algorithm.onSelection(item, option, false);

            item.nextReview = DateUtils.fromNow(result.nextReview).getTime();
            item.timesReviewed += 1;
            this.data.queue.remove(itemId);
            if (result.correct) {
                item.timesCorrect += 1;
                item.errorStreak = 0;
            } else {
                item.errorStreak += 1;

                if (this.plugin.settings.repeatItems) {
                    this.data.repeatQueue.push(itemId);
                }
            }
        }
    }

    untrackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = this.plugin.app.vault.getAbstractFileByPath(
            path
        ) as TFolder;

        if (folder != null) {
            this.untrackFilesInFolder(folder, recursive);
        }
    }

    untrackFilesInFolder(folder: TFolder, recursive?: boolean) {
        if (recursive == null) recursive = true;

        let totalRemoved: number = 0;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                if (recursive) {
                    this.untrackFilesInFolder(child, recursive);
                }
            } else if (child instanceof TFile) {
                if (this.isTracked(child.path)) {
                    let removed = this.untrackFile(child.path, false);
                    totalRemoved += removed;
                }
            }
        });
    }

    trackFilesInFolderPath(path: string, recursive?: boolean) {
        const folder: TFolder = this.plugin.app.vault.getAbstractFileByPath(
            path
        ) as TFolder;

        if (folder != null) {
            this.trackFilesInFolder(folder, recursive);
        }
    }

    trackFilesInFolder(folder: TFolder, recursive?: boolean) {
        if (recursive == null) recursive = true;

        let totalAdded: number = 0;
        let totalRemoved: number = 0;
        folder.children.forEach((child) => {
            if (child instanceof TFolder) {
                if (recursive) {
                    this.trackFilesInFolder(child, recursive);
                }
            } else if (child instanceof TFile) {
                if (!this.isTracked(child.path)) {
                    let { added, removed } = this.trackFile(child.path, false);
                    totalAdded += added;
                    totalRemoved += removed;
                }
            }
        });

        new Notice(
            "Added " +
                totalAdded +
                " new items, removed " +
                totalRemoved +
                " items."
        );
    }

    trackFile(
        path: string,
        notice?: boolean
    ): { added: number; removed: number } | null {
        this.data.trackedFiles.push({
            path: path,
            items: {},
        });
        let data = this.updateItems(path, notice);
        console.log("Tracked: " + path);
        this.plugin.updateStatusBar();
        return data;
    }

    untrackFile(path: string, notice?: boolean): number {
        if (notice == null) notice = true;

        const index = this.getFileIndex(path);

        if (index == -1) {
            return;
        }

        const trackedFile = this.data.trackedFiles[index];
        const numItems = Object.keys(trackedFile.items).length;

        for (let key in trackedFile.items) {
            const ind = trackedFile.items[key];
            if (this.isQueued(ind)) {
                this.data.queue.remove(ind);
            }
            if (this.isInRepeatQueue(ind)) {
                this.data.repeatQueue.remove(ind);
            }
            this.data.items[ind] = null;
        }

        if (notice) {
            new Notice("Untracked " + numItems + " items!");
        }

        this.data.trackedFiles[index] = null;
        this.plugin.updateStatusBar();
        console.log("Untracked: " + path);
    }

    updateItems(
        path: string,
        notice?: boolean
    ): { added: number; removed: number } | null {
        if (notice == null) notice = true;

        const ind = this.getFileIndex(path);
        if (ind == -1) {
            console.log("Attempt to update untracked file: " + path);
            return;
        }
        const trackedFile = this.data.trackedFiles[ind];

        const file = this.plugin.app.vault.getAbstractFileByPath(path) as TFile;
        if (!file) {
            console.log("Could not find file: " + path);
            return;
        }

        let added = 0;
        let removed = 0;

        let newItems: Record<string, number> = {};
        if ("file" in trackedFile.items) {
            newItems["file"] = trackedFile.items["file"];
        } else {
            let newItem: RepetitionItem = Object.assign({}, NEW_ITEM);
            newItem.data = Object.assign(this.plugin.algorithm.defaultData());
            newItem.fileIndex = ind;
            newItems["file"] = this.data.items.push(newItem) - 1;
            added += 1;
        }

        for (let key in trackedFile.items) {
            if (!(key in newItems)) {
                const itemInd = trackedFile.items[key];
                if (this.isQueued(itemInd)) {
                    this.data.queue.remove(itemInd);
                }
                if (this.isInRepeatQueue(itemInd)) {
                    this.data.repeatQueue.remove(itemInd);
                }
                this.data.items[ind] = null;
                removed += 1;
            }
        }
        trackedFile.items = newItems;

        if (notice) {
            new Notice(
                "Added " + added + " new items, removed " + removed + " items."
            );
        }
        return { added, removed };
    }

    renameTrackedFile(old: string, newPath: string) {
        const index = this.getFileIndex(old);
        // Sanity check
        if (index == -1) {
            console.log("Renamed file is not tracked!");
            return;
        }

        const fileData = this.data.trackedFiles[index];
        fileData.path = newPath;
        this.data.trackedFiles[index] = fileData;

        console.log("Updated tracking: " + old + " -> " + newPath);
    }

    buildQueue() {
        console.log("Building queue...");
        const data = this.data;
        const maxNew = this.plugin.settings.maxNewPerDay;
        const now: Date = new Date();

        if (now.getDate() != new Date(this.data.lastQueue).getDate()) {
            this.data.newAdded = 0;
        }

        let oldAdd = 0;
        let newAdd = 0;

        this.data.items.forEach((item, id) => {
            if (item != null) {
                if (item.nextReview == 0) {
                    // This is a new item.
                    if (maxNew == -1 || data.newAdded < maxNew) {
                        item.nextReview = now.getTime();
                        data.newAdded += 1;
                        data.queue.push(id);
                        newAdd += 1;
                    }
                } else if (item.nextReview <= now.getTime()) {
                    if (!this.isQueued(id)) {
                        data.queue.push(id);
                        oldAdd += 1;
                    }
                }
            }
        });

        this.data.lastQueue = now.getTime();

        console.log(
            "Added " +
                (oldAdd + newAdd) +
                " files to review queue, with " +
                newAdd +
                " new!"
        );
    }

    resetData() {
        this.data = Object.assign({}, DEFAULT_SRS_DATA);
    }
}