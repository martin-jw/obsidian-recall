import {
    FileView,
    WorkspaceLeaf,
    ViewStateResult,
    ButtonComponent,
    MarkdownRenderer,
    TFile,
} from "obsidian";
import ObsidianSrsPlugin from "./main";
import { SingleBlockSelector, IdInsert, ItemContent } from './selection';

export type ReviewMode = "question" | "answer" | "empty";

export class ReviewView extends FileView {
    plugin: ObsidianSrsPlugin;

    wrapperEl: HTMLElement;

    questionSubView: ReviewQuestionView;
    answerSubView: ReviewAnswerView;
    emptySubView: ReviewEmptyView;

    currentSubView: ReviewSubView;
    mode: ReviewMode;
    item: number;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianSrsPlugin) {
        super(leaf);

        this.plugin = plugin;

        let contentEl = this.containerEl.querySelector(
            ".view-content"
        ) as HTMLElement;
        this.wrapperEl = contentEl.createDiv("srs-review-wrapper");

        this.questionSubView = new ReviewQuestionView(this);
        this.answerSubView = new ReviewAnswerView(this);
        this.emptySubView = new ReviewEmptyView(this);

        this.currentSubView = this.emptySubView;
    }

    async setState(state: any, result: ViewStateResult): Promise<void> {
        this.mode = state.mode as ReviewMode;
        this.item = state.item;
        await super.setState(state, result);

        if (!this.file) {
            this.mode = "empty";
        }

        if (this.mode == null || this.mode == "empty") {
            this.currentSubView.hide();
            this.currentSubView = this.emptySubView;
            this.currentSubView.show();
            return;
        }

        this.currentSubView.hide();

        if (this.mode == "question") {
            this.currentSubView = this.questionSubView;
            this.currentSubView.show();
        } else if (this.mode == "answer") {
            this.currentSubView = this.answerSubView;
            this.currentSubView.show();
        }

        console.log("Loading item " + this.item + "...");

        this.app.vault.cachedRead(this.file).then(
            (content) => {
                console.log(content);
                let question: string = this.file.basename;
                let answer: string = content.trim();
                const metadata = this.app.metadataCache.getFileCache(this.file);

                if (metadata) {
                    if (metadata.sections) {

                        let sections = [...metadata.sections];
                        let idInserts: IdInsert[] = [];
                        let items: Record<string, ItemContent> = {};
                        this.plugin.settings.itemSelectors.forEach((selector) => {
                            let newItems = selector.process(sections, idInserts, content, metadata);
                            items = {...items, ...newItems};
                        });

                        console.log(sections);
                        console.log(idInserts);
                        console.log("Found ", Object.keys(items).length, " items!");
                        console.log(items);

                        //let selector = new SingleBlockSelector();
                        //console.log(idInserts);
                        //console.log(sections);
                        //console.log(metadata.sections);

                        //// Now insert IDs
                        //idInserts.sort((a, b) => b.pos.offset - a.pos.offset);
                        //let newContent = content;
                        //idInserts.forEach((insert) => {
                        //    newContent = [
                        //        newContent.slice(0, insert.pos.offset),
                        //        ' ^' + insert.id,
                        //        newContent.slice(insert.pos.offset)
                        //    ].join('');
                        //});

                        //this.app.vault.adapter.write(this.file.path, newContent);
                    }
                    if (metadata.headings && metadata.headings.length > 0) {
                        question = metadata.headings[0].heading;
                        answer = content
                            .substr(
                                metadata.headings[0].position.end.offset + 1
                            )
                            .trim();
                    }
                }
                this.currentSubView.set(question, answer, this.file);
            },
            (err) => {
                console.log("Unable to read item: " + err);
            }
        );
    }

    getState(): any {
        let state = super.getState();
        state.mode = this.mode;
        return state;
    }

    getViewType(): string {
        return "srs-review-view";
    }
}

export interface ReviewSubView {
    set(question: string, answer: string, file: TFile): void;

    show(): void;
    hide(): void;
}

export class ReviewEmptyView implements ReviewSubView {
    containerEl: HTMLElement;

    constructor(view: ReviewView) {
        this.containerEl = view.wrapperEl.createDiv("srs-review-empty");
        this.containerEl.hidden = true;

        this.containerEl.innerText = "Your queue is empty!";
    }

    set(question: string, answer: string, file: TFile) {}

    show() {
        this.containerEl.hidden = false;
    }

    hide() {
        this.containerEl.hidden = true;
    }
}

export class ReviewQuestionView implements ReviewSubView {
    containerEl: HTMLElement;

    questionEl: HTMLElement;

    constructor(view: ReviewView) {
        let answerClick = (view: ReviewView) => {
            view.leaf.setViewState({
                type: "srs-review-view",
                state: {
                    file: view.file.path,
                    mode: "answer",
                    item: view.item,
                },
            });
        };

        this.containerEl = view.wrapperEl.createDiv("srs-review-question");
        this.containerEl.hidden = true;

        this.questionEl = this.containerEl.createDiv("srs-question-content");

        let buttonDiv = this.containerEl.createDiv("srs-button-div");

        let buttonRow = buttonDiv.createDiv("srs-flex-row");
        let openFileRow = buttonDiv.createDiv("srs-flex-row");

        new ButtonComponent(buttonRow)
            .setButtonText("Show Answer")
            .setCta()
            .onClick(() => answerClick(view));

        new ButtonComponent(openFileRow)
            .setButtonText("Open File")
            .onClick(() => {
                const leaf = view.app.workspace.getUnpinnedLeaf();
                leaf.setViewState({
                    type: "markdown",
                    state: {
                        file: view.file.path,
                    },
                });
                view.app.workspace.setActiveLeaf(leaf);
            })
            .setClass("srs-review-button");
    }

    set(question: string, answer: string, file: TFile) {
        this.questionEl.empty();

        MarkdownRenderer.renderMarkdown(
            "# " + question,
            this.questionEl,
            file.path,
            null
        );
    }

    show() {
        this.containerEl.hidden = false;
    }

    hide() {
        this.containerEl.hidden = true;
    }
}

export class ReviewAnswerView implements ReviewSubView {
    containerEl: HTMLElement;

    questionEl: HTMLElement;
    answerEl: HTMLElement;
    buttons: ButtonComponent[];

    constructor(view: ReviewView) {
        let buttonClick = (view: ReviewView, s: string) => {
            view.plugin.store.reviewId(view.item, s);
            const item = view.plugin.store.getNext();
            const state: any = { mode: "empty" };
            if (item != null) {
                const path = view.plugin.store.getFilePath(item);
                if (path != null) {
                    state.file = path;
                    state.item = view.plugin.store.getNextId();
                    state.mode = "question";
                }
            }
            view.leaf.setViewState({
                type: "srs-review-view",
                state: state,
            });
        };
        this.containerEl = view.wrapperEl.createDiv("srs-review-answer");
        this.containerEl.hidden = true;

        let wrapperEl = this.containerEl.createDiv('srs-qa-wrapper');

        this.questionEl = wrapperEl.createDiv("srs-question-content");
        this.answerEl = wrapperEl.createDiv("srs-answer-content");

        let buttonDiv = this.containerEl.createDiv("srs-button-div");

        let buttonRow = buttonDiv.createDiv("srs-flex-row");
        let openFileRow = buttonDiv.createDiv("srs-flex-row");

        this.buttons = [];
        view.plugin.algorithm.srsOptions().forEach((s: string) => {
            this.buttons.push(
                new ButtonComponent(buttonRow)
                    .setButtonText(s)
                    .setCta()
                    .onClick(() => buttonClick(view, s))
                    // .setTooltip("Hotkey: " + (this.buttons.length + 1))
                    .setClass("srs-review-button")
            );
        });

        new ButtonComponent(openFileRow)
            .setButtonText("Open File")
            .onClick(() => {
                const leaf = view.app.workspace.getUnpinnedLeaf();
                leaf.setViewState({
                    type: "markdown",
                    state: {
                        file: view.file.path,
                    },
                });
                view.app.workspace.setActiveLeaf(leaf);
            })
            .setClass("srs-review-button");
    }

    set(question: string, answer: string, file: TFile) {
        this.questionEl.empty();
        this.answerEl.empty();

        MarkdownRenderer.renderMarkdown(
            "# " + question,
            this.questionEl,
            file.path,
            null
        );
        MarkdownRenderer.renderMarkdown(answer, this.answerEl, file.path, null);
    }

    show() {
        this.containerEl.hidden = false;
    }

    hide() {
        this.containerEl.hidden = true;
    }
}
