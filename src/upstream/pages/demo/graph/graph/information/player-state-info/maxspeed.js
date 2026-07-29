import { sprintf } from 'sprintf-js';

export default {
    rangeValue() {
        return '-';
    },
    value(frame) {
        const maxspeed = this.graph.data['cd']['maxspeed'].getAt(frame);
        const expectedMaxspeed = this.graph.data['maxspeed'].getAt(frame);

        if (Math.abs(expectedMaxspeed - maxspeed) < Number.EPSILON) {
            return sprintf('%0.3f', maxspeed);
        }

        return sprintf('%0.3f (%0.3f)', maxspeed, expectedMaxspeed);
    },
};

