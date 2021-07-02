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
    Split,
    SingleRegExp,
    SeparateRegExp,
    NextBlock,
    Until,
    UntilNot
}

type BlockType = 'paragraph' | 'heading' | 'yaml' | 'thematicBreak' | 'list' | 'blockquote' | 'code';

type SplitData = {
    selectorType: SelectorType.Split;
    markerBlocks: BlockType[];
    splitString: string;
}

type SingleRegExpData = {
    selectorType: SelectorType.SingleRegExp;
    markerBlocks: BlockType[];
    regExp: RegExp;
}

type SeparateRegExpData = {
    selectorType: SelectorType.SeparateRegExp;
    markerBlocks: BlockType[];
    questionRegExp: RegExp;
    answerRegExp: RegExp;
}

type NextBlockData = {
    selectorType: SelectorType.NextBlock;
    markerBlocks: BlockType[];
}

type UntilData = {
    selectorType: SelectorType.Until;
    markerBlocks: BlockType[];
    answerBlocks: BlockType[];
}

type UntilNotData = {
    selectorType: SelectorType.UntilNot;
    markerBlocks: BlockType[];
    answerBlocks: BlockType[];
}

type SingleBlockData = SplitData | SingleRegExpData | SeparateRegExpData;
type MultipleBlocksData = NextBlockData | UntilData | UntilNotData;
type SelectorData = SingleBlockData | MultipleBlocksData;

type ProcessorResult = {item: ItemContent, usedSections: number[] } | null;
type Processor = (data: SelectorData, index: number, s: SectionCache[], content: string, metadata: CachedMetadata) => ProcessorResult;

export class ItemSelector {

    private data: SelectorData;
    private processors: Record<SelectorType, Processor> = {
        [SelectorType.NextBlock]: processNextBlock,
        [SelectorType.Until]: processUntil,
        [SelectorType.UntilNot]: processUntilNot,
        [SelectorType.Split]: processSplit,
        [SelectorType.SeparateRegExp]: processSeparateRegExp,
        [SelectorType.SingleRegExp]: processSingleRegExp,
    };

    constructor() {
        this.data = <NextBlockData> {
            markerBlocks: ['heading']
        };
    }

    public process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {
        // Write general logic here, rename question/matched blocks to marker blocks
        // and let processors handle each detection.
        let items: Record<string, ItemContent> = {};
        let usedSections: number[] = [];

        for (let i = 0; i < sections.length; i++) { 
            let section: SectionCache = sections[i];

            if (this.data.markerBlocks.contains(<BlockType>section.type)) {
                let result = this.processors[this.data.selectorType](this.data, sections, content, metadata);
                if (result != null) {
                    i = result.usedSections.sort((a, b) => b - a)[0];
                }
            }
        }

        usedSections.sort((a, b) => b - a);
        usedSections.forEach((i) => sections.splice(i, 1));
        
        return items;
    }

    public processSingle(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {

        
        
    }
}
/*
export enum MultipleBlockAnswerType {
    NextBlock,
    Until,
    UntilNot,
}


export class MultipleBlockSelector extends ItemSelector {


    constructor() {
        super(SelectorType.MultipleBlocks);
        this.answerType = MultipleBlockAnswerType.NextBlock;
        this.markerBlocks = ['heading'];
    }


    public setQuestionBlocks(...blocks: BlockType[]): MultipleBlockSelector {
        this.markerBlocks = blocks;
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

    private markerBlocks: BlockType[];
    private questionType: SingleBlockQuestionType;
    private splitString: string | undefined;
    private qaRegExp: RegExp | undefined;
    private questionRegExp: RegExp | undefined;
    private answerRegExp: RegExp | undefined;

    constructor() {
        super(SelectorType.MultipleBlocks);
        this.markerBlocks = ['paragraph', 'heading', 'blockquote'];
        this.questionType = SingleBlockQuestionType.Split;
        this.splitString = "::";
    }


    public setMatchedBlocks(...blocks: BlockType[]): SingleBlockSelector {
        this.markerBlocks = blocks;
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
*/

function processNextBlock(rawData: SelectorData, index: number, sections: SectionCache[], content: string, metadata: CachedMetadata): ProcessorResult {

    let data: NextBlockData = <NextBlockData>rawData;
    let section = sections[index];
    let usedSections: number[] = [index, index + 1];
    let questionContent = content.slice(section.position.start.offset, section.position.end.offset);

    if (index + 1 < sections.length) {
        let nextBlock = sections[index + 1];
        let answerContent = content.slice(nextBlock.position.start.offset, nextBlock.position.end.offset);

        let itemContent = {
            question: questionContent,
            answer: answerContent
        };
        
        return {
            item: itemContent,
            usedSections: usedSections
        }
    }

    return null;
}

function processUntil(rawData: SelectorData, index: number, sections: SectionCache[], content: string, metadata: CachedMetadata): ProcessorResult {

    let data: UntilData = <UntilData>rawData;
    let section = sections[index];
    let questionContent = content.slice(section.position.start.offset, section.position.end.offset);

    let start: Loc | null = null;
    let end: Loc | null = null;
    let used: number[] = [index];
    for (let j = index + 1; j < sections.length; j++) {
        let block = sections[j];
        if (data.answerBlocks.contains(<BlockType>block.type)) {
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
        
        return {
            item: itemContent,
            usedSections: used,
        }
    }

    return null;
}

function processUntilNot(rawData: SelectorData, index: number, sections: SectionCache[], content: string, metadata: CachedMetadata): ProcessorResult {

    let data: UntilNotData = <UntilNotData>rawData;
    let section = sections[index];
    let questionContent = content.slice(section.position.start.offset, section.position.end.offset);

    let start: Loc | null = null;
    let end: Loc | null = null;
    let used: number[] = [index];
    for (let j = index + 1; j < sections.length; j++) {
        let block = sections[j];
        if (!data.answerBlocks.contains(<BlockType>block.type)) {
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
        
        return {
            item: itemContent,
            usedSections: used,
        }
    }

    return null;
}

function processSplit(rawData: SelectorData, sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {
    let data: SplitData = <SplitData>rawData;
    let items: Record<string, ItemContent> = {};
    let usedSections: number[] = [];

    for (let i = 0; i < sections.length; i++) { 
        let section: SectionCache = sections[i];

        if (data.markerBlocks.contains(<BlockType>section.type)) {
            let sectionContent = content.slice(section.position.start.offset, section.position.end.offset);
            let split = sectionContent.split(data.splitString, 2);
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
        }
    }

    return {} // TODO
}

function processSeparateRegExp(rawData: SelectorData, sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {
    let data: SeparateRegExpData = <SeparateRegExpData>rawData;
    let items: Record<string, ItemContent> = {};
    let usedSections: number[] = [];

    for (let i = 0; i < sections.length; i++) { 
        let section: SectionCache = sections[i];

        if (data.markerBlocks.contains(<BlockType>section.type)) {
            let sectionContent = content.slice(section.position.start.offset, section.position.end.offset);

            let questionMatch = sectionContent.match(data.questionRegExp);
            let answerMatch = sectionContent.match(data.answerRegExp);
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

    return {} // TODO
}

function processSingleRegExp(rawData: SelectorData, sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {
    let data: SingleRegExpData = <SingleRegExpData>rawData;
    let items: Record<string, ItemContent> = {};
    let usedSections: number[] = [];

    for (let i = 0; i < sections.length; i++) { 
        let section: SectionCache = sections[i];

        if (data.markerBlocks.contains(<BlockType>section.type)) {
            let sectionContent = content.slice(section.position.start.offset, section.position.end.offset);
            let match = sectionContent.match(data.qaRegExp);
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

    return {} // TODO
}
