import { sprintf } from 'sprintf-js';

export default {
    rangeValue(frameFrom, frameTo) {
        return sprintf('%d - %d (%d)', frameFrom, frameTo, frameTo - frameFrom + 1);
    },
    value(frame) {
        return frame;
    },
};

