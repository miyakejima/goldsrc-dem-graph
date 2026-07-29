import { sprintf } from 'sprintf-js';

const maxCommands = 6;
const getCommandsList = function (frameFrom, frameTo) {
    let commands = [];

    for (let frame = frameFrom; frame <= frameTo; frame++) {
        if (frame in this.graph.data['commands']) {
            const frameCommands = this.graph.data['commands'][frame].split(';');

            frameCommands.forEach(command => {
                if (!commands.includes(command)) {
                    commands.push(command);
                }
            });
        }
    }

    if (commands.length > maxCommands) {
        commands = commands
            .slice(0, maxCommands)
            .concat(sprintf('and %d more...', commands.length - maxCommands));
    }

    return commands.join('\n');
};

export default {
    rangeValue(frameFrom, frameTo) {
        return getCommandsList.call(this, frameFrom, frameTo);
    },
    value(frame) {
        return getCommandsList.call(this, frame, frame);
    },
};

