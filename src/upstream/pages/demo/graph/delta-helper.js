'use strict';

const DeltaHelper = {
    _frames: undefined,

    getAt(frame) {
        if (!this._frames) {
            this._frames = Object.keys(this).map(Number);
        }

        var latestFrame = this._binarySearch(this._frames, frame);

        if (latestFrame !== undefined) {
            return Number(this[latestFrame]);
        }

        return undefined;
    },

    _binarySearch(array, key) {
        var lo = 0,
            hi = array.length - 1,
            mid,
            element;

        while (lo <= hi) {
            mid = ((lo + hi) >> 1);
            element = array[mid];
            if (element < key) {
                lo = mid + 1;
            } else if (element > key) {
                hi = mid - 1;
            } else {
                return element;
            }
        }

        return element > key ? array[mid - 1] : element;
    },
};

export default DeltaHelper;

