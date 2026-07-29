import { Container, Graphics, Point, Text, Color } from 'pixi.js';

import FrameInfoFrame from './information/frame-info/frame';
import FrameInfoTime from './information/frame-info/time';
import FrameInfoRealFps from './information/frame-info/real-fps';
import FrameInfoEngineFps from './information/frame-info/engine-fps';
import FrameInfoFrameLength from './information/frame-info/frame-length';
import FrameInfoMsec from './information/frame-info/msec';
import FrameInfoMovetype from './information/frame-info/movetype';
import FrameInfoHealth from './information/frame-info/health';

import PlayerStateInfoOriginX from './information/player-state-info/origin-x';
import PlayerStateInfoOriginY from './information/player-state-info/origin-y';
import PlayerStateInfoOriginZ from './information/player-state-info/origin-z';
import PlayerStateInfoVelocityX from './information/player-state-info/velocity-x';
import PlayerStateInfoVelocityY from './information/player-state-info/velocity-y';
import PlayerStateInfoVelocityZ from './information/player-state-info/velocity-z';
import PlayerStateInfoVelocityXY from './information/player-state-info/velocity-xy';
import PlayerStateInfoFUser2 from './information/player-state-info/fuser2';

import PlayerStateInfoWeaponAmmo from './information/player-state-info/weapon-ammo';
import PlayerStateInfoMaxSpeed from './information/player-state-info/maxspeed';
import PlayerStateInfoForwardMove from './information/player-state-info/forwardmove';
import PlayerStateInfoSideMove from './information/player-state-info/sidemove';
import PlayerStateInfoUpMove from './information/player-state-info/upmove';

import InfoFlags from './information/flags';
import InfoButtons from './information/buttons';
import InfoCommands from './information/commands';

export default class Information {
    constructor(graph) {
        this.graph = graph;
        this.infos = {};
        this.groups = {};
        this.border = new Graphics();

        this.config = {
            frameInfo: {
                position: new Point(0, 0),
                labels: {
                    frame: {
                        label: {
                            text: 'Frame',
                            position: new Point(5, 5),
                        },
                        value: {
                            rangeValue: FrameInfoFrame.rangeValue,
                            value: FrameInfoFrame.value,
                            position: new Point(210, 5),
                        },
                    },
                    time: {
                        label: {
                            text: ['Server Time', 'Demo Time'],
                            position: new Point(5, 20),
                        },
                        value: {
                            rangeValue: FrameInfoTime.rangeValue,
                            value: FrameInfoTime.value,
                            position: new Point(210, 20),
                        },
                    },
                    realFps: {
                        label: {
                            text: 'Real fps',
                            textRange: 'Real fps (avg)',
                            position: new Point(5, 35),
                        },
                        value: {
                            rangeValue: FrameInfoRealFps.rangeValue,
                            value: FrameInfoRealFps.value,
                            position: new Point(210, 35),
                        },
                    },
                    engineFps: {
                        label: {
                            text: 'Engine fps',
                            textRange: 'Engine fps (avg)',
                            position: new Point(5, 50),
                        },
                        value: {
                            rangeValue: FrameInfoEngineFps.rangeValue,
                            value: FrameInfoEngineFps.value,
                            position: new Point(210, 50),
                        },
                    },
                    frameLength: {
                        label: {
                            text: 'Frame length',
                            textRange: 'Frame length (avg)',
                            position: new Point(5, 65),
                        },
                        value: {
                            rangeValue: FrameInfoFrameLength.rangeValue,
                            value: FrameInfoFrameLength.value,
                            position: new Point(210, 65),
                        },
                    },
                    msec: {
                        label: {
                            text: 'MSec',
                            textRange: 'MSec (summary)',
                            position: new Point(5, 80),
                        },
                        value: {
                            rangeValue: FrameInfoMsec.rangeValue,
                            value: FrameInfoMsec.value,
                            position: new Point(210, 80),
                        },
                    },
                    movetype: {
                        label: {
                            text: 'Movetype',
                            position: new Point(5, 95),
                        },
                        value: {
                            rangeValue: FrameInfoMovetype.rangeValue,
                            value: FrameInfoMovetype.value,
                            position: new Point(210, 95),
                        },
                    },
                    health: {
                        label: {
                            text: 'Health',
                            position: new Point(5, 110),
                        },
                        value: {
                            rangeValue: FrameInfoHealth.rangeValue,
                            value: FrameInfoHealth.value,
                            position: new Point(210, 110),
                        },
                    },
                },
            },

            playerStateInfo: {
                position: new Point(215, 0),
                labels: {
                    originX: {
                        label: {
                            text: 'Origin X',
                            position: new Point(5, 5),
                        },
                        value: {
                            rangeValue: PlayerStateInfoOriginX.rangeValue,
                            value: PlayerStateInfoOriginX.value,
                            position: new Point(210, 5),
                        },
                    },
                    originY: {
                        label: {
                            text: 'Origin Y',
                            position: new Point(5, 20),
                        },
                        value: {
                            rangeValue: PlayerStateInfoOriginY.rangeValue,
                            value: PlayerStateInfoOriginY.value,
                            position: new Point(210, 20),
                        },
                    },
                    originZ: {
                        label: {
                            text: 'Origin Z',
                            position: new Point(5, 35),
                        },
                        value: {
                            rangeValue: PlayerStateInfoOriginZ.rangeValue,
                            value: PlayerStateInfoOriginZ.value,
                            position: new Point(210, 35),
                        },
                    },
                    velocityX: {
                        label: {
                            text: 'Velocity X',
                            position: new Point(5, 50),
                        },
                        value: {
                            rangeValue: PlayerStateInfoVelocityX.rangeValue,
                            value: PlayerStateInfoVelocityX.value,
                            position: new Point(210, 50),
                        },
                    },
                    velocityY: {
                        label: {
                            text: 'Velocity Y',
                            position: new Point(5, 65),
                        },
                        value: {
                            rangeValue: PlayerStateInfoVelocityY.rangeValue,
                            value: PlayerStateInfoVelocityY.value,
                            position: new Point(210, 65),
                        },
                    },
                    velocityZ: {
                        label: {
                            text: 'Velocity Z',
                            position: new Point(5, 80),
                        },
                        value: {
                            rangeValue: PlayerStateInfoVelocityZ.rangeValue,
                            value: PlayerStateInfoVelocityZ.value,
                            position: new Point(210, 80),
                        },
                    },
                    velocity: {
                        label: {
                            text: 'Velocity XY',
                            position: new Point(5, 95),
                        },
                        value: {
                            rangeValue: PlayerStateInfoVelocityXY.rangeValue,
                            value: PlayerStateInfoVelocityXY.value,
                            position: new Point(210, 95),
                        },
                    },
                    fuser2: {
                        label: {
                            text: 'fuser2',
                            position: new Point(5, 110),
                        },
                        value: {
                            rangeValue: PlayerStateInfoFUser2.rangeValue,
                            value: PlayerStateInfoFUser2.value,
                            position: new Point(210, 110),
                        },
                    },
                },
            },

            playerStateInfo2: {
                position: new Point(430, 0),
                labels: {
                    weaponAndAmmo: {
                        label: {
                            text: 'Weapon',
                            position: new Point(5, 5),
                        },
                        value: {
                            rangeValue: PlayerStateInfoWeaponAmmo.rangeValue,
                            value: PlayerStateInfoWeaponAmmo.value,
                            position: new Point(210, 5),
                        },
                    },
                    maxspeed: {
                        label: {
                            text: 'Maxspeed',
                            position: new Point(5, 20),
                        },
                        value: {
                            rangeValue: PlayerStateInfoMaxSpeed.rangeValue,
                            value: PlayerStateInfoMaxSpeed.value,
                            position: new Point(210, 20),
                        },
                    },
                    forwardMove: {
                        label: {
                            text: 'Forwardmove',
                            position: new Point(5, 35),
                        },
                        value: {
                            rangeValue: PlayerStateInfoForwardMove.rangeValue,
                            value: PlayerStateInfoForwardMove.value,
                            position: new Point(210, 35),
                        },
                    },
                    sideMove: {
                        label: {
                            text: 'Sidemove',
                            position: new Point(5, 50),
                        },
                        value: {
                            rangeValue: PlayerStateInfoSideMove.rangeValue,
                            value: PlayerStateInfoSideMove.value,
                            position: new Point(210, 50),
                        },
                    },
                    upMove: {
                        label: {
                            text: 'Upmove',
                            position: new Point(5, 65),
                        },
                        value: {
                            rangeValue: PlayerStateInfoUpMove.rangeValue,
                            value: PlayerStateInfoUpMove.value,
                            position: new Point(210, 65),
                        },
                    },
                },
            },

            flagsAndButtonsInfo: {
                position: new Point(645, 0),
                labels: {
                    flags: {
                        label: {
                            text: 'Flags',
                            position: new Point(5, 5),
                        },
                        value: {
                            position: new Point(200, 5),
                            rangeValue: InfoFlags.rangeValue,
                            value: InfoFlags.value,
                        },
                    },
                    buttons: {
                        label: {
                            text: 'Buttons',
                            position: new Point(5, 50),
                        },
                        value: {
                            rangeValue: InfoButtons.rangeValue,
                            value: InfoButtons.value,
                            position: new Point(200, 50),
                        },
                    },
                },
            },

            commandsInfo: {
                position: new Point(850, 0),
                labels: {
                    commands: {
                        label: {
                            text: 'Commands',
                            position: new Point(5, 5),
                        },
                        value: {
                            rangeValue: InfoCommands.rangeValue,
                            value: InfoCommands.value,
                            position: new Point(200, 5),
                        },
                    },
                },
            },
        };

        graph.on('init', () => this.init());
        graph.on('resize', () => this.resize());
        graph.on('dataLoaded', () => this.drawInfo());
        graph.on('moveCursor', () => this.drawInfo());
        graph.on('setMarker1', () => this.drawInfo());
        graph.on('setMarker2', () => this.drawInfo());
        graph.on('setFocus', () => this.drawInfo());
    }

    init() {
        var fontConfig = {
                fontFamily: 'Roboto',
                fontSize: '13px',
                fontWeight: 'bold',
                fill: new Color('#888888'),
                align: 'right',
            },
            config;

        for (var groupName in this.config) {
            if (!this.config.hasOwnProperty(groupName)) {
                continue;
            }

            this.groups[groupName] = new Container();
            this.groups[groupName].position = this.config[groupName].position;

            this.infos[groupName] = {};

            for (var name in this.config[groupName].labels) {
                if (!this.config[groupName].labels.hasOwnProperty(name)) {
                    continue;
                }

                config = this.config[groupName].labels[name];

                if (!Array.isArray(config.label.text)) {
                    config.label.text = [config.label.text];
                }

                this.infos[groupName][name] = {};
                this.infos[groupName][name].label = new Text(
                    config.label.text[0],
                    config.label.text.length > 1 ? Object.assign({}, fontConfig, {fill: new Color('#DDDDDD')}) : fontConfig,
                );
                this.infos[groupName][name].mode = 0;
                this.infos[groupName][name].label.position = config.label.position;

                if (config.label.text.length > 1) {
                    this.infos[groupName][name].label.eventMode = 'static';
                    this.infos[groupName][name].label.cursor = 'pointer';
                    this.infos[groupName][name].label.on('click', this.onLabelClick.bind(this, true, this.infos[groupName][name], config.label.text.length));
                    this.infos[groupName][name].label.on('rightclick', this.onLabelClick.bind(this, false, this.infos[groupName][name], config.label.text.length));
                }

                this.infos[groupName][name].value = new Text('', fontConfig);
                this.infos[groupName][name].value.position = config.value.position;
                this.infos[groupName][name].value.anchor.set(1, 0);

                this.groups[groupName].addChild(this.infos[groupName][name].label);
                this.groups[groupName].addChild(this.infos[groupName][name].value);
            }

            this.graph.information.addChild(this.groups[groupName]);
        }

        this.graph.information.addChild(this.border);
    }

    resize() {
        this.redraw();
    }

    redraw() {
        this.border.clear();
        this.border.lineStyle(1, new Color('#888888'), 1);
        this.border.moveTo(0, 130);
        this.border.lineTo(this.graph.renderer.width, 130);
    }

    onLabelClick(forward, config, totalModes) {
        if (forward) {
            if (config.mode === totalModes - 1) {
                config.mode = 0;
            } else {
                config.mode++;
            }
        } else {
            if (config.mode === 0) {
                config.mode = totalModes - 1;
            } else {
                config.mode--;
            }
        }

        this.drawInfo();
    }

    dataLoaded() {
        this.drawInfo();
    }

    drawInfo() {
        if (!this.graph.data) {
            return;
        }

        var fn = (this.graph.focusFrame === undefined && this.graph.marker1Frame !== undefined) ? 'rangeValue' : 'value',
            args = [];

        if (this.graph.focusFrame !== undefined) {
            args.push(this.graph.focusFrame);
        } else if (this.graph.marker1Frame !== undefined) {
            var frameFrom,
                frameTo = this.graph.marker2Frame || this.graph.cursorFrame;

            if (frameTo < this.graph.marker1Frame) {
                frameFrom = frameTo;
                frameTo = this.graph.marker1Frame;
            } else {
                frameFrom = this.graph.marker1Frame;
            }

            args.push(frameFrom, frameTo);
        } else {
            args.push(this.graph.cursorFrame);
        }

        for (var groupName in this.infos) {
            if (!this.infos.hasOwnProperty(groupName)) {
                continue;
            }

            if (this.config[groupName].renderable) {
                this.groups[groupName].renderable = this.config[groupName].renderable.call(this);
            }

            for (var name in this.infos[groupName]) {
                if (!this.infos[groupName].hasOwnProperty(name)) {
                    continue;
                }

                var valueText = this.config[groupName].labels[name].value[fn].apply(this, args.concat(this.infos[groupName][name].mode)),
                    labelText;

                if (valueText !== null && valueText !== this.infos[groupName][name].value.text) {
                    this.infos[groupName][name].value.text = valueText;
                }

                if (this.graph.marker1Frame !== undefined && this.config[groupName].labels[name].label.textRange) {
                    labelText = this.config[groupName].labels[name].label.textRange;
                } else {
                    labelText = this.config[groupName].labels[name].label.text[this.infos[groupName][name].mode];
                }

                if (labelText !== this.infos[groupName][name].label.text) {
                    this.infos[groupName][name].label.text = labelText;
                }

                this.infos[groupName][name].label.renderable = this.infos[groupName][name].value.renderable = valueText !== null;
            }
        }
    }
};

