# Recall - Spaced Repetition System in Obsidian!
This plugin for [Obsidian](https://obsidian.md/) implements a spaced repetition system for reviewing information, with any SRS algorithm.

See [planned features](https://github.com/martin-jw/obsidian-recall#planned-features) for upcoming updates. To request a feature that isn't already planned, or to report a bug, please [raise an issue](https://github.com/martin-jw/obsidian-recall/issues).

## Quick Guide

1. [install](https://github.com/martin-jw/obsidian-recall#installation) the plugin.

2. Select the [algorithm](https://github.com/martin-jw/obsidian-recall#algorithms) you want to use.

3. Start [tracking notes](https://github.com/martin-jw/obsidian-recall#tracking-notes).

4. [Review](https://github.com/martin-jw/obsidian-recall#review) them!

## Installation
The plugin is not yet available in Obsidian's community plugin section, so until then the plugin has to be installed manually.

### Manual installation
In your vault, navigate to `.obsidian/plugins` and create a folder called `obsidian-recall`. Add the `main.js`, `manifest.json` and `styles.css` files from the [latest release](https://github.com/martin-jw/obsidian-recall/releases) to the folder.

## Tracking notes
This plugin tracks notes for review in a separate file called `tracked_files.json` in a configurable location. This means that you don't need to make any changes to a note that you want to review. To track a note, either right-click a note in the file explorer and click `Track Note`, or run the command `SRS: Track Note` to track the currently active file.

You can also recursively track all notes in a folder by right-clicking a folder in the explorer and pressing `Track All Notes`.

**Currently, the top-most header of the file will be taken as the question of the note.** If there are no headers the file name will be used. This will most likely be changed very soon.

### Untracking notes

Untracking notes is done the same way, simply right-click a note in the explorer and click `Untrack Note`, or run the command `SRS: Untrack Note`.

You can also recursively remove all notes in a folder from the SRS by right-clicking the folder in the explorer and pressing `Untrack All Notes`.

Note that untracking a note removes all information regarding the note from the system, and any progress will therefore be reset.

### The status bar

This plugin adds a status to the status bar of Obsidian. This status changes depending on which note is being viewed:
- When viewing a tracked note, it shows when that note is next to be reviewed.
- When viewing an untracked note, it shows the number of notes currently in the queue.
- When in Review, it shows the number of items remaining in the review.

## Reviewing Items
To review due items, run the `SRS: Review` command. This will build the queue and open up the review view, and any items due for review will be shown.

### Adding hotkeys
Any of the `SRS:` commands can be bound to hotkeys in the Obsidian `Hotkeys` section of the settings. There are currently not hotkeys for the different responses of the review view, however it is planned.

## Algorithms

This plugin uses a modular way of adding algorithms. This means that you can choose which algorithm to use for reviews depending on your needs. Currently, only a few algorithms are implemented. If you want to request a specific algorithm to be added please file a [feature request](https://github.com/martin-jw/obsidian-recall/issues). If you feel like an algorithm is behaving incorrectly or is missing something, plase [report a bug](https://github.com/martin-jw/obsidian-recall/issues).

### Changing algorithms

Since SRS algorithms can be quite different, an algorithm can define it's own data to use track with the repetition items. This means that different algorithms could have conflicting data, and as such switching algorithms when you already have existing items could set back, reset or alter the review intervals for existing items.

Because of this, switching algorithms currently requires a reload of the plugin.

## Currently available algorithms

### Anki

This is an implementation of the [Anki algorithm](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html). 

It uses the same data structure as the SM2 algorithm, and as such you can switch between them without losing data.

#### Settings

For more details of the settings available see [Anki's documentation](https://docs.ankiweb.net/#/deck-options).

### SM2

An implementation of SuperMemo's algorithm, [SM2](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2). This is the algorithm that Anki's algorithm is based on.

This algorithm currently exposes no settings. It uses the same data structure as the Anki algorithm, and as such you can switch between them without losing data.

### Leitner

This is an implementation of the [Leitner System](https://www.wikiwand.com/en/Leitner_system), also known as the shoebox method. Items are separated into "boxes" (called stages in the settings) and each box has a set interval of time between reviews. 

When an item is marked as correct it graduates to the next stage. If an item is marked as wrong it is returned to the first stage.

#### Settings

**Stages** - The number of stages. Changing this updates the maximum number of stages available to the system.

**Reset When Incorrect** - Whether or not to move back to the initial stage when incorrect, or simply move back one stage.

**Timings** - The timings of each stage.

# Planned Features

These are features currently planned, without any inherent order of priority:

- [ ] Multiple items per note.
  - [ ] Extract separate headings as separate questions and SRS items.
- [ ] More ways to identify repetition items
  - [ ] Flashcard style: `question::answer`
  - [ ] Different levels of headings
  - [ ] Dividers
  - [ ] Cloze deletions?
- [ ] Custom queues and reviews.
  - [ ] Leverage Obsidian's search filters to specify which notes to review, and review notes without updating their status.
- [ ] Expose more of the SRS data to the user.
  - [ ] Show lists of all the current items in the SRS.
  - [ ] Expose the data of items and allow the user to change it manually.
