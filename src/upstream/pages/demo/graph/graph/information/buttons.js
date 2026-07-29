import { buttons as buttonsMap } from '../../consts';

export default {
    rangeValue(frameFrom, frameTo) {
        let buttons = Number(this.graph.data['cmd']['buttons'][frameFrom]);

        for (let frame = frameFrom + 1; frame <= frameTo; frame++) {
            buttons |= Number(this.graph.data['cmd']['buttons'][frame]) || 0;
        }

        return Object.entries(buttonsMap)
            .filter(([, buttonValue]) => buttons & buttonValue)
            .map(([buttonName]) => buttonName)
            .join('\n');
    },
    value(frame) {
        const buttons = Number(this.graph.data['cmd']['buttons'][frame]);

        return Object.entries(buttonsMap)
            .filter(([, buttonValue]) => buttons & buttonValue)
            .map(([buttonName]) => buttonName)
            .join('\n');
    },
};

