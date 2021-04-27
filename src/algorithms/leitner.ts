import SrsAlgorithm from "./../algorithms";
import { ReviewResult, RepetitionItem } from "./../data";
import { DateUtils, ObjectUtils } from "./../utils";

import { Setting, Notice, TextComponent } from "obsidian";

interface LeitnerSettings {
    stages: number;
    resetOnIncorrect: boolean;
    timings: number[];
}

interface LeitnerData {
    stage: number;
}

export class LeitnerAlgorithm extends SrsAlgorithm {
    settings: LeitnerSettings;
    timingsList: HTMLDivElement;

    defaultSettings(): LeitnerSettings {
        return {
            stages: 6,
            resetOnIncorrect: true,
            timings: [1, 3, 7, 14, 30, 180],
        };
    }

    defaultData(): LeitnerData {
        return {
            stage: 0,
        };
    }

    srsOptions(): String[] {
        return ["Wrong", "Correct"];
    }

    onSelection(
        item: RepetitionItem,
        option: String,
        repeat: boolean
    ): ReviewResult {
        const data = item.data;

        if (data.stage === "undefined") {
            data.stage = 0;
        }

        if (option == "Correct") {
            if (repeat) {
                return { correct: true, nextReview: -1 };
            }
            data.stage += 1;

            if (data.stage > this.settings.stages) {
                data.stage = this.settings.stages;
            }

            return {
                correct: true,
                nextReview:
                    this.settings.timings[data.stage - 1] *
                    DateUtils.DAYS_TO_MILLIS,
            };
        } else {
            if (repeat) {
                return { correct: false, nextReview: -1 };
            }

            if (this.settings.resetOnIncorrect) {
                data.stage = 1;
            } else {
                data.stage = Math.max(1, data.stage - 1);
            }
            return {
                correct: false,
                nextReview:
                    this.settings.timings[data.stage - 1] *
                    DateUtils.DAYS_TO_MILLIS,
            };
        }
    }

    displaySettings(
        containerEl: HTMLElement,
        update: (settings: any) => void
    ): void {
        new Setting(containerEl)
            .setName("Stages")
            .setDesc("The number of SRS stages.")
            .addText((text) =>
                text
                    .setPlaceholder("Stages")
                    .setValue(this.settings.stages.toString())
                    .onChange((newValue) => {
                        const stages = Number(newValue);

                        if (isNaN(stages)) {
                            new Notice("Stages must be a number.");
                            return;
                        }

                        if (!Number.isInteger(stages) || stages < 1) {
                            new Notice(
                                "Stages must be an integer larger than 0."
                            );
                            return;
                        }

                        const old = this.settings.stages;
                        this.settings.stages = stages;

                        if (old < stages) {
                            this.settings.timings.push(
                                ...new Array<number>(stages - old).fill(0)
                            );
                        } else if (old > stages) {
                            this.settings.timings = this.settings.timings.slice(
                                0,
                                stages
                            );
                        }

                        this.updateTimingsList(update);
                        update(this.settings);
                    })
            );

        new Setting(containerEl)
            .setName("Reset When Incorrect")
            .setDesc(
                "If true, a review item is moved back to the first stage when marked as incorrect. Otherwise it simply moves back to the previous stage."
            )
            .addToggle((toggle) => {
                toggle.setValue(this.settings.resetOnIncorrect);
                toggle.onChange((val) => {
                    this.settings.resetOnIncorrect = val;
                    update(this.settings);
                });
            });

        const timingsDiv = containerEl.createDiv(
            "timings-setting-item setting-item"
        );
        timingsDiv.createDiv("setting-item-info", (div) => {
            div.createDiv("setting-item-name").innerText = "Timings";
            div.createDiv("setting-item-description").innerText =
                "The timings (in days) of each SRS stage.";
        });
        this.timingsList = timingsDiv.createDiv("setting-item-control");
        this.updateTimingsList(update);
    }

    updateTimingsList(update: (settings: any) => void) {
        this.timingsList.empty();
        this.settings.timings.forEach((val, ind) => {
            new TextComponent(this.timingsList)
                .setPlaceholder(ind.toString())
                .setValue(val.toString())
                .onChange((newValue) => {
                    const num = Number(newValue);

                    if (isNaN(num)) {
                        new Notice("Timing must be a number.");
                        return;
                    }

                    if (!Number.isInteger(num) || num < 1) {
                        new Notice("Stages must be an integer larger than 0.");
                        return;
                    }

                    this.settings.timings[ind] = num;
                    update(this.settings);
                });
        });
    }
}
