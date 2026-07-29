import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        return sprintf(
            '%0.3f - %0.3f',
            this.graph.data['cd']['origin[2]'].getAt(frameFrom),
            this.graph.data['cd']['origin[2]'].getAt(frameTo),
        );
    },
    value(frame) {
        return sprintf('%0.3f', this.graph.data['cd']['origin[2]'].getAt(frame));
    },
};

