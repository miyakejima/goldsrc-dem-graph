import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        return sprintf(
            '%0.3f - %0.3f',
            this.graph.data['cd']['velocity[1]'].getAt(frameFrom),
            this.graph.data['cd']['velocity[1]'].getAt(frameTo),
        );
    },
    value(frame) {
        return sprintf('%0.3f', this.graph.data['cd']['velocity[1]'].getAt(frame));
    },
};

