import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        var slice = this.graph.data['frametime'].slice(frameFrom, frameTo + 1),
            sum = 0;

        slice.forEach(function (frametime) {
            sum += frametime;
        });

        return sprintf('%0.5f', 1 / sum * slice.length);
    },
    value(frame) {
        return sprintf('%0.5f', 1 / this.graph.data['frametime'][frame]);
    },
};

