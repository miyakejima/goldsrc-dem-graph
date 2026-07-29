import { flags as flagsMap } from '../../consts';

export default {
    rangeValue(frameFrom, frameTo) {
        let flags = Number(this.graph.data['cd']['flags'].getAt(frameFrom)) || 0;

        for (let frame = frameFrom + 1; frame <= frameTo; frame++) {
            if (frame in this.graph.data['cd']['flags']) {
                flags |= Number(this.graph.data['cd']['flags'][frame]);
            }
        }

        return Object.entries(flagsMap)
            .filter(([, flagValue]) => flags & flagValue)
            .map(([flagName]) => flagName)
            .join('\n');
    },
    value(frame) {
        const flags = Number(this.graph.data['cd']['flags'].getAt(frame));

        return Object.entries(flagsMap)
            .filter(([, flagValue]) => flags & flagValue)
            .map(([flagName]) => flagName)
            .join('\n');
    },
};

