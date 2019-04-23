import React, { Component } from 'react'
import $ from 'jquery'
import memoize from 'memoize-one'
import './office.css'

const CELL_SIZE = 260
const CELL_QTY = 25

const INITIAL_STATE = {
    selectedElement: undefined,
    offset: { x: 0, y: 0 },
    viewBox: undefined,
    svg: undefined,
    xPosition: undefined,
    yPosition: undefined,
    transformMatrix: undefined
}

export default class OfficeMap extends Component {

    constructor(props) {
        super(props)

        const viewBox =
            OfficeMap.calculateViewBox(this.props.data,
                this.props.horizontalSize,
                this.props.verticalSize)

        const transformMatrix = [1, 0, 0, 1, 0, 0]

        this.state = { ...INITIAL_STATE, viewBox, transformMatrix }
    }

    static getDerivedStateFromProps(nextProps, prevState) {
        if (nextProps.data !== prevState.data) {
            const viewBox =
                OfficeMap.calculateViewBox(nextProps.data,
                    nextProps.horizontalSize,
                    nextProps.verticalSize)
            return { viewBox }
        } else {
            return null
        }
    }

    pan(dx, dy) {
        const transformMatrix = this.state.transformMatrix

        transformMatrix[4] += dx;
        transformMatrix[5] += dy;

        this.setMatrix(transformMatrix)
    }

    zoom(scale) {
        const transformMatrix = this.state.transformMatrix
        const viewBox = this.state.viewBox

        const centerX = parseFloat(viewBox.width) / 2;
        const centerY = parseFloat(viewBox.height) / 2;

        for (let i = 0; i < 6; i++) {
            transformMatrix[i] *= scale;
        }
        transformMatrix[4] += (1 - scale) * centerX;
        transformMatrix[5] += (1 - scale) * centerY;

        this.setMatrix(transformMatrix)
    }

    setMatrix(transformMatrix) {
        let svg = this.state.svg
        if (!svg) {
            svg = document.getElementById("svg")
            this.setState({ svg })
        }
        if (svg) {
            const newMatrix = "matrix(" + transformMatrix.join(' ') + ")";
            var matrixGroup = svg.getElementById("matrix-group")
            matrixGroup.setAttributeNS(null, "transform", newMatrix);

            this.setState({ transformMatrix })
        }
    }

    unSelectDesk() {
        $('#selectableRect').css('visibility', 'hidden')
        $('#selectableRect').attr('x', 0)
        $('#selectableRect').attr('y', 0)
    }

    static calculateViewBox = memoize((data, horizontalSize, verticalSize) => {
        const maximus = data && data.reduce((maximus, desk) => {
            maximus.x = Math.max(maximus.x, desk.x)
            maximus.y = Math.max(maximus.y, desk.y)
            return maximus
        }, { x: 0, y: 0 })

        maximus.x = horizontalSize ? horizontalSize : maximus.x + 1
        maximus.y = verticalSize ? verticalSize : maximus.y + 1

        const width = maximus.x * CELL_SIZE + 2
        const height = maximus.y * CELL_SIZE + 2

        return { minX: 0, minY: 0, width, height }
    })

    mountFieldsMessage = (equipment, fields) => {
        return equipment && fields && fields.reduce((message, field, index) => {
            if (message && field && equipment[field]) {
                message += ' - '
            }
            if (field && equipment[field] && index === 0) {
                message += equipment[field].toUpperCase()
            } else if (field && equipment[field]) {
                message += equipment[field]
            }
            if (index === fields.length - 1) {
                message += '\n'
            }
            return message
        }, '')
    }

    getEquipmentInfo = desk => {
        const fields = this.props.fields || ['type', 'specification']

        const equipments = desk.equipments || []
        let equipmentsInfo = equipments.reduce((message, equipment) => {
            if (fields && fields.length && equipment[fields[0]]) {
                message += message ? "" : `DESK ${desk.id}\n`
                message += this.mountFieldsMessage(equipment, fields)
            }

            return message
        }, "")

        return equipmentsInfo || `DESK ${desk.id}`
    }

    selectDesk = (event) => {
        if (this.props.onSelect) {
            const x = event.target.x.baseVal.value
            const y = event.target.y.baseVal.value

            const xRect = $('#selectableRect').attr('x')
            const yRect = $('#selectableRect').attr('y')
            const visibility = $('#selectableRect').css('visibility')

            if (x === +xRect && y === +yRect && visibility === 'visible') {
                this.unSelectDesk()
            } else {
                $('#selectableRect').css('visibility', 'visible')
                $('#selectableRect').attr('x', x)
                $('#selectableRect').attr('y', y)

                const desk = this.props.data.filter(d => d.id === +event.target.id)[0]

                this.props.onSelect(desk)
            }
        }
    }

    startDrag = (event) => {
        const selectedElement = event.target

        $(`#${selectedElement.id}`).insertBefore("#svgLastElement")

        let offset = this.getMousePosition(event)

        const xPosition = parseInt(offset.x / CELL_SIZE)
        const yPosition = parseInt(offset.y / CELL_SIZE)

        offset.x -= selectedElement.getAttributeNS(null, "x")
        offset.y -= selectedElement.getAttributeNS(null, "y")


        this.setState({ selectedElement, offset, xPosition, yPosition })
    }

    endDrag(event) {
        const selectedElement = this.state.selectedElement
        if (selectedElement) {
            var coord = this.getMousePosition(event)

            const xPosition = parseInt(coord.x / CELL_SIZE)
            const yPosition = parseInt(coord.y / CELL_SIZE)

            let x = xPosition * CELL_SIZE
            let y = yPosition * CELL_SIZE

            selectedElement.setAttributeNS(null, "x", x)
            selectedElement.setAttributeNS(null, "y", y)

            const xPositionBefore = this.state.xPosition
            const yPositionBefore = this.state.yPosition

            this.setState({ selectedElement: undefined, xPosition: undefined, yPosition: undefined })

            if (this.props.onMove &&
                (xPosition !== xPositionBefore ||
                    yPosition !== yPositionBefore)) {
                const id = event.target.id
                const desk = this.props.data.filter(d => d.id === +id)[0]
                this.props.onMove({ ...desk, x: xPosition, y: yPosition })

                if (this.props.onSelect) {
                    const x = parseInt($('#selectableRect').attr('x') / CELL_SIZE)
                    const y = parseInt($('#selectableRect').attr('y') / CELL_SIZE)

                    if (x === xPositionBefore && y === yPositionBefore) {
                        this.unSelectDesk()
                    }
                }

            } else if (this.props.onSelect) {
                const x = parseInt($('#selectableRect').attr('x') / CELL_SIZE)
                const y = parseInt($('#selectableRect').attr('y') / CELL_SIZE)
                const visibility = $('#selectableRect').css('visibility')

                if (x === xPositionBefore && y === yPositionBefore
                    && visibility === 'visible') {
                    this.unSelectDesk()
                } else {
                    this.selectDesk(event)
                }
            }
        }
    }

    getMousePosition(event) {
        let svg = this.state.svg
        if (!svg) {
            svg = document.getElementById("svg")
            this.setState({ svg })
        }

        const transformMatrix = this.state.transformMatrix

        if(!transformMatrix) {
            transformMatrix = [1, 0, 0, 1, 0, 0]
            this.setState({transformMatrix})
        }

        const CTM = svg.getScreenCTM()
        return {
            x: (event.clientX - CTM.e - transformMatrix[4]) / (CTM.a * transformMatrix[0]),
            y: (event.clientY - CTM.f - transformMatrix[5]) / (CTM.d * transformMatrix[3])
        }
    }

    drag(event) {
        const selectedElement = this.state.selectedElement
        const offset = this.state.offset
        if (selectedElement) {
            var coord = this.getMousePosition(event)
            let dx = coord.x - offset.x
            let dy = coord.y - offset.y

            selectedElement.setAttributeNS(null, "x", dx)
            selectedElement.setAttributeNS(null, "y", dy)
        }
    }

    showEditMode() {
        if (this.props.editMode) {
            return (<rect x={0} y={0} width={CELL_QTY * CELL_SIZE} height={CELL_QTY * CELL_SIZE} fill="url(#pattern)" />)
        }
        return undefined
    }

    showDesks() {
        return this.props.data && this.props.data.map(desk =>
            (<use
                id={desk.id}
                style={this.props.onMove ? { cursor: 'grab' } : {}}
                key={`key_${desk.id}`}
                href={`#${this.getDeskId(desk)}`}
                x={desk.x * CELL_SIZE}
                y={desk.y * CELL_SIZE}
                className="clickable draggable"
                onMouseDown={this.props.onMove ? event => this.startDrag(event) : () => { }}
                onMouseMove={this.props.onMove ? event => this.drag(event) : () => { }}
                onMouseUp={this.props.onMove ? event => this.endDrag(event) : () => { }}
                onClick={this.props.onSelect ? event => this.selectDesk(event) : () => { }}>
                <title>{this.getEquipmentInfo(desk)}</title>
            </use>))
    }

    getDeskComponentsTypes(desk) {
        const deskComponents = desk.equipments ? desk.equipments.map(e => e.type ? e.type.toLowerCase() : '') : []
        const definedComponents = ['chair', 'drawer', 'desk', 'keyboard', 'mouse', 'monitor', 'phone', 'cpu', 'desktop', 'laptop']
        return definedComponents.filter(component => ['desk'].concat(deskComponents).includes(component))
    }

    getDeskComponents(desk) {
        const transformMap = {
            'south': '',
            'north': `rotate(-180 ${CELL_SIZE / 2 + 1} ${CELL_SIZE / 2 + 1})`,
            'east': `rotate(-90 ${CELL_SIZE / 2 + 1} ${CELL_SIZE / 2 + 1})`,
            'west': `rotate(90 ${CELL_SIZE / 2 + 1} ${CELL_SIZE / 2 + 1})`,
            'north-east': `rotate(-135 ${CELL_SIZE / 2 + 17} ${CELL_SIZE / 2 - 38})`,
            'south-west': `rotate(45 ${CELL_SIZE / 2 - 93} ${CELL_SIZE / 2 - 38})`,
            'south-east': `rotate(-45 ${CELL_SIZE / 2 + 95} ${CELL_SIZE / 2 - 38})`,
            'north-west': `rotate(135 ${CELL_SIZE / 2 - 15} ${CELL_SIZE / 2 - 38})`
        }

        const deskComponents = this.getDeskComponentsTypes(desk)
        return deskComponents.map(component =>
            (<use
                key={`component_${desk.chairDirection}_${component}`}
                href={`#${component}`}
                transform={transformMap[desk.chairDirection]} />))
    }

    buildDesksDefinitions() {
        const keys = []
        return this.props.data && this.props.data.reduce((desksDefinitions, desk) => {
            const deskId = this.getDeskId(desk)
            const key = `desks_definition_${deskId}`
            if (!keys.includes(key)) {
                keys.push(key)

                const deskComponents = this.getDeskComponents(desk)
                desksDefinitions.push(<g key={key} id={deskId} >{deskComponents}</g>)
            }
            return desksDefinitions
        }, [])
    }

    getDeskId(desk) {
        const chairDirection = desk.chairDirection
        const deskComponents = this.getDeskComponentsTypes(desk)
        return deskComponents.reduce((deskId, component) => {
            deskId += '_' + component
            return deskId
        }, chairDirection)
    }

    showNavigator() {
        if (this.props.showNavigator) {
            return (
                <g id="navigator">
                    <circle cx="36" cy="36" r="32" fill="white" />
                    <path className="button_directional" onClick={() => this.pan(0, CELL_SIZE / 4)} d="M128 320l128-128 128 128z" transform="translate(10 -13) scale(0.1 0.1)" />
                    <path className="button_directional" onClick={() => this.pan(0, -CELL_SIZE / 4)} d="M128 192l128 128 128-128z" transform="translate(10 33) scale(0.1 0.1)" />
                    <path className="button_directional" onClick={() => this.pan(-CELL_SIZE / 4, 0)} d="M192 128l128 128-128 128z" transform="translate(33 10) scale(0.1 0.1)" />
                    <path className="button_directional" onClick={() => this.pan(CELL_SIZE / 4, 0)} d="M320 128L192 256l128 128z" transform="translate(-13 10) scale(0.1 0.1)" />
                    <rect className="button" x="16" y="16.5" width="17.5" height="8" transform="translate(-4 -5) scale(1.6 1.6)" onClick={() => this.zoom(0.75)} rx="1" ry="1" />
                    <rect className="button" x="16" y="26" width="17.5" height="8" transform="translate(-4 -5) scale(1.6 1.6)" onClick={() => this.zoom(1.25)} rx="1" ry="1" />
                    <rect class="plus-minus" x="23" y="19.5" width="4" height="1" transform="translate(-4 -4) scale(1.6 1.6)" />
                    <rect class="plus-minus" x="23" y="29" width="4" height="1" transform="translate(-4 -4) scale(1.6 1.6)" />
                    <rect class="plus-minus" x="24.5" y="27.5" width="1" height="4" transform="translate(-4 -4) scale(1.6 1.6)" />
                </g>
            )
        } else {
            return undefined
        }
    }

    render() {
        const viewBox = this.state.viewBox
        const transformMatrix = this.state.transformMatrix
        return (
            <svg id="svg"
                viewBox={`${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`}
                style={{ background: 'linear-gradient(to bottom right, #ece9e6, #ffffff)' }}>
                <defs>
                    <g id="chair">
                        <rect width="70" height="75" stroke="black" fill="#1a2980" transform="translate(90 90)" strokeWidth='0.7' rx="25" ry="25" />
                        <rect width="60" height="12" stroke="black" fill="#a5a5a5" transform="translate(94 162)" strokeWidth='0.7' rx="15" ry="15" />
                        <rect width="10" height="40" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.7' }} transform="translate(82 105)" rx="3" ry="3" />
                        <rect width="10" height="40" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.7' }} transform="translate(158 105)" rx="3" ry="3" />
                        <line x1="95" y1="168" x2="153" y2="168" style={{ stroke: '#5b5b5b', strokeWidth: 0.7 }} rx="3" ry="3" />
                    </g>
                    <g id="drawer">
                        <rect width="64" height="100" stroke="black" fill="#c4c4c4" transform="translate(183 15)" strokeWidth='0.7' rx="1" ry="1" />
                        <rect width="20" height="5" style={{ fill: 'transparent', stroke: 'black', strokeWidth: '2' }} transform="translate(205 118)" rx="1" ry="1" />
                        <rect width="64" height="4" stroke="black" fill="#a5a5a5" transform="translate(183 115)" strokeWidth='0.7' rx="1" ry="1" />
                    </g>
                    <g id="keyboard">
                        <rect width="93" height="32" x="78" y="59" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: '0.7' }} rx="1" ry="1" />
                        <rect width="52" height="4" x="98" y="81" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="84" y="81" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="91" y="81" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="154" y="81" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="161" y="81" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />

                        <rect width="18" height="4" x="84" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="105" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="112" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="119" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="126" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="133" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="140" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="18" height="4" x="147" y="73" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />

                        <rect width="11" height="4" x="84" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="98" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="105" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="112" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="119" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="126" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="133" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="140" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="147" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="11" height="4" x="154" y="65" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                    </g>
                    <g id="monitor">
                        <rect width="30" height="14" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: 0.7 }} transform="translate(111 15)" rx="1" ry="1" />
                        <rect width="103" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: 0.7 }} transform="translate(73 20)" rx="1" ry="1" />
                    </g>
                    <g id="phone">
                        <rect width="44" height="45" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: '0.7' }} transform="translate(203 15)" rx="1" ry="1" />
                        <rect width="19" height="10" style={{ fill: '#f0f0f0', stroke: 'black', strokeWidth: '0.5' }} transform="translate(223 20)" rx="1" ry="1" />
                        <rect width="10" height="35" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(208 20)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(223 36)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(223 43)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(223 50)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(230 36)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(230 43)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(230 50)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(237 36)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(237 43)" rx="1" ry="1" />
                        <rect width="4" height="4" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} transform="translate(237 50)" rx="1" ry="1" />
                    </g>
                    <g id="mouse">
                        <rect width="12" height="20" x="184" y="71" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: '0.7' }} rx="4" ry="4" />
                        <line x1="190" y1="72" x2="190" y2="78" style={{ stroke: 'black', strokeWidth: 0.5 }} />
                    </g>
                    <g id="desk">
                        <rect width="260" height="104" x="1" y="1" style={{ fill: 'white', stroke: 'black', strokeWidth: 1 }} rx="1" ry="1" />
                    </g>
                    <g id="cpu">
                        <rect width="40" height="76" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: 0.7 }} transform="translate(15 15)" rx="1" ry="1" />
                    </g>
                    <g id="desktop">
                        <use href="#cpu" />
                        <use href="#keyboard" />
                        <use href="#mouse" />
                    </g>
                    <g id="laptop">
                        <rect width="103" height="3" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: 0.7 }} transform="translate(73 15)" rx="2" ry="2" />
                        <polygon points="78,32 171,32 176,17 73,17" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: 0.7 }} rx="1" ry="1" />
                        <polygon points="80,30 169,30 173,19 76,19" style={{ fill: '#cacaca', stroke: 'black', strokeWidth: 0.5 }} rx="1" ry="1" />

                        <rect width="93" height="58" x="78" y="33" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: '0.7' }} rx="1" ry="1" />
                        <rect width="20" height="12" x="114" y="72" style={{ fill: '#e1e1e1', stroke: 'black', strokeWidth: '0.7' }} rx="1" ry="1" />
                        <rect width="52" height="4" x="98" y="61" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="84" y="61" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="91" y="61" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="154" y="61" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="161" y="61" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />

                        <rect width="18" height="4" x="84" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="105" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="112" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="119" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="126" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="133" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="140" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="18" height="4" x="147" y="53" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />

                        <rect width="11" height="4" x="84" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="98" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="105" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="112" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="119" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="126" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="133" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="140" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="4" height="4" x="147" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />
                        <rect width="11" height="4" x="154" y="45" style={{ fill: '#a5a5a5', stroke: 'black', strokeWidth: '0.5' }} rx="1" ry="1" />

                        <line x1="124" y1="78" x2="124" y2="83" style={{ stroke: 'black', strokeWidth: 0.5 }} />
                    </g>
                    {this.buildDesksDefinitions()}
                    <pattern id="pattern" x="0" y="0" width={1 / CELL_QTY} height={1 / CELL_QTY}>
                        <rect x="1" y="1" width={CELL_SIZE} height={CELL_SIZE} style={{ fill: "none", stroke: 'black', strokeWidth: 0.4 }} />
                    </pattern>
                </defs>
                <g id="matrix-group" transform="matrix(1 0 0 1 0 0)">
                    <rect id="selectableRect" x={0} y={0} width="260" height="260" style={{ fill: '#d0d6f5', strokeWidth: 1, stroke: '#1a2980', visibility: 'hidden' }} transform="translate(1 1)" rx="1" ry="1" onClick={this.unSelectDesk} />
                    {this.showEditMode()}
                    {this.showDesks()}
                    <rect id="svgLastElement" x={0} y={0} width={0} height={0} />
                </g>
                {this.showNavigator()}
            </svg>)
    }
}