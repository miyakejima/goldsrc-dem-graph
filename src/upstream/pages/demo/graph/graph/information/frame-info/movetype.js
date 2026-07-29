import { sprintf } from 'sprintf-js';
import { movetype } from '../../../consts';

const movetypeValueToNameMap = Object.assign({}, ...Object.entries(movetype).map(([key, value]) => ({[value]: key})));

export default {
    rangeValue(frameFrom, frameTo) {
        let movetypes = {};
        let movetype;

        for (let frame = frameFrom; frame <= frameTo; frame++) {
            movetype = String(this.graph.data['esp']['movetype'].getAt(frame));
            movetypes[movetype] = movetypes[movetype] || 0;
            movetypes[movetype]++;
        }

        const [topMovetypeValue, topMovetypeFrames] = Object.entries(movetypes).reduce(
            ([topMovetypeValue, topMovetypeFrames], [movetypeValue, movetypeFrames]) => {
                if (movetypeFrames > topMovetypeFrames) {
                    return [movetypeValue, movetypeFrames];
                }

                return [topMovetypeValue, topMovetypeFrames];
            },
            [null, -1],
        );

        const topMovetypeName = movetypeValueToNameMap[topMovetypeValue] || null;

        if (topMovetypeName) {
            return sprintf('%s (%d/%d)', topMovetypeName, topMovetypeFrames, frameTo - frameFrom + 1);
        }

        return '-';
    },
    value(frame) {
        const movetype = String(this.graph.data['esp']['movetype'].getAt(frame));

        return movetypeValueToNameMap[movetype] || null;
    },
};

