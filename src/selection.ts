import {Loc, Pos, SectionCache, CachedMetadata, Notice} from 'obsidian';
import { BlockUtils, MiscUtils } from './utils';

export interface IdInsert {
    id: string,
    pos: Loc
}

export interface ItemContent {
    question: string;
    answer: string;
}

export enum SelectorType {
    SingleBlock,
    MultipleBlocks,
}

type BlockType = 'paragraph' | 'heading' | 'yaml' | 'thematicBreak' | 'list' | 'blockquote' | 'code';

export abstract class ItemSelector {

    public selectorType: SelectorType;

    constructor(type: SelectorType) {
        this.selectorType = type;
    }

    public abstract process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent>; 
}

export enum MultipleBlockAnswerType {
    NextBlock,
    Until,
    UntilNot,
}

export class MultipleBlockSelector extends ItemSelector {

    private answerType: MultipleBlockAnswerType;
    private questionBlocks: BlockType[];
    private answerBlocks: BlockType[] | null;

    constructor() {
        super(SelectorType.MultipleBlocks);
        this.answerType = MultipleBlockAnswerType.NextBlock;
        this.questionBlocks = ['heading'];
    }

    public process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {

        let items: Record<string, ItemContent> = {};
        let usedSections: number[] = [];

        for (let i = 0; i < sections.length; i++) {
            let section = sections[i];

            if (this.questionBlocks.contains(<BlockType>section.type)) {
                let questionContent = content.slice(section.position.start.offset, section.position.end.offset);
                
                switch(this.answerType) {
                    case MultipleBlockAnswerType.NextBlock: {
                        if (i + 1 < sections.length) {
                            let nextBlock = sections[i + 1];
                            let answerContent = content.slice(nextBlock.position.start.offset, nextBlock.position.end.offset);

                            let itemContent = {
                                question: questionContent,
                                answer: answerContent
                            };
                            
                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.push(i);
                            usedSections.push(i + 1);
                            i += 1;
                        }
                        break;
                    }
                    case MultipleBlockAnswerType.Until: {
                        let start: Loc | null = null;
                        let end: Loc | null = null;
                        let used: number[] = [i];
                        let j;
                        for (j = i + 1; j < sections.length; j++) {
                            let block = sections[j];
                            if (this.answerBlocks.contains(<BlockType>block.type)) {
                                break;
                            }
                            else {
                                if (start === null) {
                                    start = block.position.start;
                                }
                                end = block.position.end;
                                used.push(j);
                            }
                        }

                        if (start !== null) {
                            let answerContent = content.slice(start.offset, end.offset);

                            let itemContent = {
                                question: questionContent,
                                answer: answerContent
                            };
                            
                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.concat(used);
                            i = j - 1;
                        }
                        break;
                    }
                    case MultipleBlockAnswerType.UntilNot: {
                        let start: Loc | null = null;
                        let end: Loc | null = null;
                        let used: number[] = [i];
                        let j;
                        for (j = i + 1; j < sections.length; j++) {
                            let block = sections[j];
                            if (!this.answerBlocks.contains(<BlockType>block.type)) {
                                break;
                            }
                            else {
                                if (start === null) {
                                    start = block.position.start;
                                }
                                end = block.position.end;
                                used.push(j);
                            }
                        }

                        if (start !== null) {
                            let answerContent = content.slice(start.offset, end.offset);

                            let itemContent = {
                                question: questionContent,
                                answer: answerContent
                            };
                            
                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.concat(used);
                            i = j - 1;
                        }
                        break;
                    }
                }
            }
        }

        return items;
    }

    public setQuestionBlocks(...blocks: BlockType[]): MultipleBlockSelector {
        this.questionBlocks = blocks;
        return this;
    }

    public setModeNextBlock(): MultipleBlockSelector {
        this.answerType = MultipleBlockAnswerType.NextBlock;
        return this;
    }

    public setModeUntil(...answerBlocks: BlockType[]): MultipleBlockSelector {
        this.answerType = MultipleBlockAnswerType.Until;
        this.answerBlocks = answerBlocks;
        return this;
    }

    public setModeUntilNot(...answerBlocks: BlockType[]): MultipleBlockSelector {
        this.answerType = MultipleBlockAnswerType.UntilNot;
        this.answerBlocks = answerBlocks;
        return this;
    }
}

export enum SingleBlockQuestionType {
    Split,
    SingleRegExp,
    SeparateRegExp
}

export class SingleBlockSelector extends ItemSelector {

    private matchedBlocks: BlockType[];
    private questionType: SingleBlockQuestionType;
    private splitString: string | undefined;
    private qaRegExp: RegExp | undefined;
    private questionRegExp: RegExp | undefined;
    private answerRegExp: RegExp | undefined;

    constructor() {
        super(SelectorType.MultipleBlocks);
        this.matchedBlocks = ['paragraph', 'heading', 'blockquote'];
        this.questionType = SingleBlockQuestionType.Split;
        this.splitString = "::";
    }

    public process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {

        let items: Record<string, ItemContent> = {};
        let usedSections: number[] = [];
        
        for (let i = 0; i < sections.length; i++) { 
            let section: SectionCache = sections[i];

            if (this.matchedBlocks.contains(<BlockType>section.type)) {
                let sectionContent = content.slice(section.position.start.offset, section.position.end.offset);

                switch(this.questionType) {
                    case SingleBlockQuestionType.Split: {
                        let split = sectionContent.split(this.splitString, 2);
                        if (split.length == 2) {
                            let itemContent = {
                                question: split[0],
                                answer: split[1]
                            }

                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.push(i);
                        }
                        break;
                    }
                    case SingleBlockQuestionType.SingleRegExp: {
                        let match = sectionContent.match(this.qaRegExp);
                        if (match !== null) {
                            let itemContent = {
                                question: match[1],
                                answer: match[2],
                            }

                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.push(i);
                        }
                        break;
                    }
                    case SingleBlockQuestionType.SeparateRegExp: {
                        let questionMatch = sectionContent.match(this.questionRegExp);
                        let answerMatch = sectionContent.match(this.answerRegExp);
                        if (questionMatch !== null && answerMatch !== null) {
                            let itemContent = {
                                question: questionMatch[1],
                                answer: answerMatch[1],
                            }

                            let id = section.id;
                            if (id === undefined) {
                                id = BlockUtils.generateBlockId();
                                inserts.push({id: id, pos: section.position.end});
                            }
                            items[id] = itemContent;
                            usedSections.push(i);
                        }
                        break;
                    }
                }
            }
        }
        
        usedSections.sort((a, b) => b - a);
        usedSections.forEach((i) => sections.splice(i, 1));
        
        return items;
    }

    public setMatchedBlocks(...blocks: BlockType[]): SingleBlockSelector {
        this.matchedBlocks = blocks;
        return this;
    }

    public setSplit(splitStr: string): SingleBlockSelector {
        this.questionType = SingleBlockQuestionType.Split;
        this.splitString = splitStr;
        return this;
    }

    public setSingleRegExp(exp: RegExp): SingleBlockSelector {

        if (MiscUtils.getRegExpGroups(exp) >= 2) {
            this.questionType = SingleBlockQuestionType.SingleRegExp;
            this.qaRegExp = exp;
        } else {
            new Notice("Single block regular expression needs at least 2 capturing groups!");
        }

        return this;
    }

    public setMultipleRegExp(questionExp: RegExp, answerExp: RegExp): SingleBlockSelector {

        if (MiscUtils.getRegExpGroups(questionExp) < 1) {
            new Notice("Question regular expression must have at least one capturing group!");
            return this;
        }
        if (MiscUtils.getRegExpGroups(answerExp) < 1) {
            new Notice("Answer regular expression must have at least one capturing group!");
            return this;
        }

        this.questionType = SingleBlockQuestionType.SeparateRegExp;
        this.questionRegExp = questionExp;
        this.answerRegExp = answerExp;

        return this;
    }
}



