import { Loc, SectionCache, CachedMetadata } from 'obsidian';
import { BlockUtils, MiscUtils } from './utils';

export interface IdInsert {
    id: string,
    pos: Loc
}

export interface ItemContent {
    question: string;
    answer: string;
}

type BlockType = 'paragraph' | 'heading' | 'yaml' | 'thematicBreak' | 'list' | 'blockquote' | 'code';

/**
 * Abstract class to extract items from a note.
 */
export abstract class ItemSelector {

    public abstract process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent>; 
}

/**
 * Extract items over multiple blocks
 */
export class BlockSelector {

    questionBlocks: BlockType[];
    answerBlocks: BlockType[];
    until: boolean;

    BlockSelector(questionBlocks: BlockType[], answerBlocks: BlockType[]) {
        this.questionBlocks = questionBlocks;
        this.answerBlocks = answerBlocks;
        this.until = false;
    }

    public process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {

        let items: Record<string, ItemContent> = {};
        let usedSections: number[] = [];

        for (let i = 0; i < sections.length; i++) {
            let section = sections[i];
            let questionContent = content.slice(section.position.start.offset, section.position.end.offset);

            let start: Loc | null = null;
            let end: Loc | null = null;
            let used: number[] = [i];
            for (let j = i + 1; j < sections.length; j++) {
                let block = sections[j];
                let contains = this.answerBlocks.contains(<BlockType>block.type);
                if ((contains && this.until) || (!contains && !this.until)) {
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
                usedSections = usedSections.concat(used);
            }
        }

        usedSections.sort((a, b) => b - a);
        usedSections.forEach((i) => sections.splice(i, 1));

        return items;
    }
}

/**
 * Extract inline items in sections (maximum 1 per section)
 */
export class InlineSelector extends ItemSelector {

    matchingRegex: RegExp;
    blockTypes: BlockType[];

    InlineSelector(regex: RegExp) {

        this.matchingRegex = regex;
    }

    public process(sections: SectionCache[], inserts: IdInsert[], content: string, metadata: CachedMetadata): Record<string, ItemContent> {

        let items: Record<string, ItemContent> = {};
        let usedSections: number[] = [];

        for (let i = 0; i < sections.length; i++) { 
            let section: SectionCache = sections[i];

            if (this.blockTypes.contains(<BlockType>section.type)) {
                let sectionContent = content.slice(section.position.start.offset, section.position.end.offset);
                let match = sectionContent.match(this.matchingRegex);
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
            }
        }

        usedSections.sort((a, b) => b - a);
        usedSections.forEach((i) => sections.splice(i, 1));

        return items;
    }
}
