import { sprintf } from 'sprintf-js';

const weaponsShortNames = [
    'n/a', 'p228', 'shield', 'scout', 'hegrenade', 'xm1014', 'c4', 'mac10', 'aug', 'smokegrenade',
    'elite', 'fiveseven', 'ump45', 'sg550', 'galil', 'famas', 'usp', 'glock18', 'awp', 'mp5navy',
    'm249', 'm3', 'm4a1', 'tmp', 'g3sg1', 'flashbang', 'deagle', 'sg552', 'ak47', 'knife', 'p90',
];

const weaponsSpeeds = [
    0, 250, 0, 260, 250, 240, 250, 250, 240, 250,
    250, 250, 250, 210, 240, 240, 250, 250, 210, 250,
    220, 230, 230, 250, 210, 250, 250, 235, 221, 250, 245,
];

export default {
    rangeValue() {
        return '-';
    },
    value(frame) {
        const weaponId = this.graph.data['cd']['m_iId'].getAt(frame);
        const ammoType = this.graph.data['cd']['vuser4[0]'].getAt(frame);
        const ammo = this.graph.data['cd']['vuser4[1]'].getAt(frame);
        const clip = this.graph.data['wd']['iClip'].getAt(frame);

        if (!weaponId) {
            return 'n/a';
        }

        if (ammoType === 511) { // should be -1
            return sprintf('%s (%dms)', weaponsShortNames[weaponId], weaponsSpeeds[weaponId]);
        }

        return sprintf(
            '%s (%dms) %d/%d',
            weaponsShortNames[weaponId],
            weaponsSpeeds[weaponId],
            clip,
            ammo,
        );
    },
};

