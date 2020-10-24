// @flow

import * as React from 'react'
import styled from 'styled-components'

// Import only the methods we need from date-fns in order to keep build size small
import addMinutes from 'date-fns/add_minutes'
import addHours from 'date-fns/add_hours'
import addDays from 'date-fns/add_days'
import startOfDay from 'date-fns/start_of_day'
import isSameMinute from 'date-fns/is_same_minute'
import formatDate from 'date-fns/format'

import { Text, Subtitle } from './typography'
import colors from './colors'
import selectionSchemes from './selection-schemes'

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  user-select: none;
`

const Grid = styled.div`
  display: grid;
  grid-template-columns: auto repeat(${props => props.columns}, 1fr);
  grid-template-rows: auto repeat(${props => props.rows}, 1fr);
  column-gap: ${props => props.columnGap};
  row-gap: ${props => props.rowGap};
  width: 100%;
`

export const GridCell = styled.div`
  touch-action: none;
`

const DateCell = styled.div`
  width: 100%;
  height: 25px;
  background-color: ${props => (props.selected ? props.selectedColor : props.unselectedColor)};

  &:hover {
    background-color: ${props => props.hoveredColor};
  }
`

const DateLabel = styled(Subtitle)`
  @media (max-width: 699px) {
    font-size: 12px;
  }
  margin: 0;
  margin-bottom: 4px;
`

const TimeText = styled(Text)`
  @media (max-width: 699px) {
    font-size: 10px;
  }
  text-align: right;
  margin: 0;
  margin-right: 4px;
`

type PropsType = {
  selection: Array<Date>,
  selectionScheme: SelectionSchemeType,
  onChange: (Array<Date>) => void,
  startDate: Date,
  numDays: number,
  minTime: number,
  maxTime: number,
  hourlyChunks: number,
  dateFormat: string,
  timeFormat: string,
  columnGap: string | number,
  rowGap: string | number,
  unselectedColor: string,
  selectedColor: string,
  hoveredColor: string,
  renderDateCell?: (datetime: Date, selected: boolean, refSetter: (HTMLElement) => void) => React.Node,
  renderTimeLabel?: (time: Date) => React.Node,
  renderDateLabel?: (date: Date) => React.Node
}

type StateType = {
  // In the case that a user is drag-selecting, we don't want to call this.props.onChange() until they have completed
  // the drag-select. selectionDraft serves as a temporary copy during drag-selects.
  selectionDraft: Array<Date>,
  selectionType: ?SelectionType,
  selectionStart: ?Date,
  isTouchDragging: boolean
}

export const preventScroll = (e: TouchEvent) => {
  e.preventDefault()
}

export default class ScheduleSelector extends React.Component<PropsType, StateType> {
  dates: Array<Array<Date>>
  selectionSchemeHandlers: { [string]: (Date, Date, Array<Array<Date>>) => Date[] }
  cellToDate: Map<HTMLElement, Date>
  documentMouseUpHandler: () => void
  endSelection: () => void
  handleTouchMoveEvent: (SyntheticTouchEvent<*>) => void
  handleTouchEndEvent: () => void
  handleMouseUpEvent: Date => void
  handleMouseEnterEvent: Date => void
  handleSelectionStartEvent: Date => void
  gridRef: ?HTMLElement

  static defaultProps: $Shape<PropsType> = {
    selection: [],
    selectionScheme: 'square',
    numDays: 7,
    minTime: 9,
    maxTime: 23,
    hourlyChunks: 1,
    startDate: new Date(),
    timeFormat: 'ha',
    dateFormat: 'M/D',
    columnGap: '4px',
    rowGap: '4px',
    selectedColor: colors.blue,
    unselectedColor: colors.paleBlue,
    hoveredColor: colors.lightBlue,
    onChange: () => {}
  }

  static getDerivedStateFromProps(props: PropsType, state: StateType): $Shape<StateType> | null {
    // As long as the user isn't in the process of selecting, allow prop changes to re-populate selection state
    if (state.selectionStart == null) {
      return {
        selectionDraft: [...props.selection]
      }
    }
    return null
  }

  constructor(props: PropsType) {
    super(props)

    // Generate list of dates to render cells for
    const startTime = startOfDay(props.startDate)
    this.dates = []
    this.cellToDate = new Map()
    const minutesInChunk = Math.floor(60 / props.hourlyChunks)
    for (let d = 0; d < props.numDays; d += 1) {
      const currentDay = []
      for (let h = props.minTime; h < props.maxTime; h += 1) {
        for (let c = 0; c < props.hourlyChunks; c += 1) {
          currentDay.push(addMinutes(addHours(addDays(startTime, d), h), c * minutesInChunk))
        }
      }
      this.dates.push(currentDay)
    }

    this.state = {
      selectionDraft: [...this.props.selection], // copy it over
      selectionType: null,
      selectionStart: null,
      isTouchDragging: false
    }

    this.selectionSchemeHandlers = {
      linear: selectionSchemes.linear,
      square: selectionSchemes.square
    }

    this.endSelection = this.endSelection.bind(this)
    this.handleMouseUpEvent = this.handleMouseUpEvent.bind(this)
    this.handleMouseEnterEvent = this.handleMouseEnterEvent.bind(this)
    this.handleTouchMoveEvent = this.handleTouchMoveEvent.bind(this)
    this.handleTouchEndEvent = this.handleTouchEndEvent.bind(this)
    this.handleSelectionStartEvent = this.handleSelectionStartEvent.bind(this)
  }

  componentDidMount() {
    // We need to add the endSelection event listener to the document itself in order
    // to catch the cases where the users ends their mouse-click somewhere besides
    // the date cells (in which case none of the DateCell's onMouseUp handlers would fire)
    //
    // This isn't necessary for touch events since the `touchend` event fires on
    // the element where the touch/drag started so it's always caught.
    document.addEventListener('mouseup', this.endSelection)

    // Prevent page scrolling when user is dragging on the date cells
    this.cellToDate.forEach((value, dateCell) => {
      if (dateCell && dateCell.addEventListener) {
        dateCell.addEventListener('touchmove', preventScroll, { passive: false })
      }
    })
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.endSelection)
    this.cellToDate.forEach((value, dateCell) => {
      if (dateCell && dateCell.removeEventListener) {
        dateCell.removeEventListener('touchmove', preventScroll)
      }
    })
  }

  // Performs a lookup into this.cellToDate to retrieve the Date that corresponds to
  // the cell where this touch event is right now. Note that this method will only work
  // if the event is a `touchmove` event since it's the only one that has a `touches` list.
  getTimeFromTouchEvent(event: SyntheticTouchEvent<*>): ?Date {
    const { touches } = event
    if (!touches || touches.length === 0) return null
    const { clientX, clientY } = touches[0]
    const targetElement = document.elementFromPoint(clientX, clientY)
    if (targetElement) {
      const cellTime = this.cellToDate.get(targetElement)
      return cellTime
    }
    return null
  }

  endSelection() {
    this.props.onChange(this.state.selectionDraft)
    this.setState({
      selectionType: null,
      selectionStart: null
    })
  }

  // Given an ending Date, determines all the dates that should be selected in this draft
  updateAvailabilityDraft(selectionEnd: ?Date, callback?: () => void) {
    const { selectionType, selectionStart } = this.state

    if (selectionType === null || selectionStart === null) return

    let newSelection = []
    if (selectionStart && selectionEnd && selectionType) {
      newSelection = this.selectionSchemeHandlers[this.props.selectionScheme](selectionStart, selectionEnd, this.dates)
    }

    let nextDraft = [...this.props.selection]
    if (selectionType === 'add') {
      nextDraft = Array.from(new Set([...nextDraft, ...newSelection]))
    } else if (selectionType === 'remove') {
      nextDraft = nextDraft.filter(a => !newSelection.find(b => isSameMinute(a, b)))
    }

    this.setState({ selectionDraft: nextDraft }, callback)
  }

  // Isomorphic (mouse and touch) handler since starting a selection works the same way for both classes of user input
  handleSelectionStartEvent(startTime: Date) {
    // Check if the startTime cell is selected/unselected to determine if this drag-select should
    // add values or remove values
    const timeSelected = this.props.selection.find(a => isSameMinute(a, startTime))
    this.setState({
      selectionType: timeSelected ? 'remove' : 'add',
      selectionStart: startTime
    })
  }

  handleMouseEnterEvent(time: Date) {
    // Need to update selection draft on mouseup as well in order to catch the cases
    // where the user just clicks on a single cell (because no mouseenter events fire
    // in this scenario)
    this.updateAvailabilityDraft(time)
  }

  handleMouseUpEvent(time: Date) {
    this.updateAvailabilityDraft(time)
    // Don't call this.endSelection() here because the document mouseup handler will do it
  }

  handleTouchMoveEvent(event: SyntheticTouchEvent<*>) {
    this.setState({ isTouchDragging: true })
    const cellTime = this.getTimeFromTouchEvent(event)
    if (cellTime) {
      this.updateAvailabilityDraft(cellTime)
    }
  }

  handleTouchEndEvent() {
    if (!this.state.isTouchDragging) {
      // Going down this branch means the user tapped but didn't drag -- which
      // means the availability draft hasn't yet been updated (since
      // handleTouchMoveEvent was never called) so we need to do it now
      this.updateAvailabilityDraft(null, () => {
        this.endSelection()
      })
    } else {
      this.endSelection()
    }
    this.setState({ isTouchDragging: false })
  }

  renderDateCellWrapper = (time: Date): React.Element<*> => {
    const startHandler = () => {
      this.handleSelectionStartEvent(time)
    }

    const selected = Boolean(this.state.selectionDraft.find(a => isSameMinute(a, time)))

    return (
      <GridCell
        className="rgdp__grid-cell"
        role="presentation"
        key={time.toISOString()}
        // Mouse handlers
        onMouseDown={startHandler}
        onMouseEnter={() => {
          this.handleMouseEnterEvent(time)
        }}
        onMouseUp={() => {
          this.handleMouseUpEvent(time)
        }}
        // Touch handlers
        // Since touch events fire on the event where the touch-drag started, there's no point in passing
        // in the time parameter, instead these handlers will do their job using the default SyntheticEvent
        // parameters
        onTouchStart={startHandler}
        onTouchMove={this.handleTouchMoveEvent}
        onTouchEnd={this.handleTouchEndEvent}
      >
        {this.renderDateCell(time, selected)}
      </GridCell>
    )
  }

  renderDateCell = (time: Date, selected: boolean): React.Node => {
    const refSetter = (dateCell: HTMLElement | null) => {
      if (dateCell) {
        this.cellToDate.set(dateCell, time)
      }
    }
    if (this.props.renderDateCell) {
      return this.props.renderDateCell(time, selected, refSetter)
    } else {
      return (
        <DateCell
          selected={selected}
          ref={refSetter}
          selectedColor={this.props.selectedColor}
          unselectedColor={this.props.unselectedColor}
          hoveredColor={this.props.hoveredColor}
        />
      )
    }
  }

  renderTimeLabel = (time: Date): React.Node => {
    if (this.props.renderTimeLabel) {
      return this.props.renderTimeLabel(time)
    } else {
      return <TimeText>{formatDate(time, this.props.timeFormat)}</TimeText>
    }
  }

  renderDateLabel = (date: Date): React.Node => {
    if (this.props.renderDateLabel) {
      return this.props.renderDateLabel(date)
    } else {
      return <DateLabel>{formatDate(date, this.props.dateFormat)}</DateLabel>
    }
  }

  renderFullDateGrid(): Array<React.Node> {
    const flattenedDates = this.dates.reduce((acc, dayOfDates) => acc.concat(dayOfDates), [])
    const dateGridElements = flattenedDates.map(this.renderDateCellWrapper)
    const numDays = this.dates.length
    const numTimes = this.dates[0].length
    for (let i = 0; i < numTimes; i += 1) {
      const index = i * numDays
      const time = this.dates[0][i]
      // Inject the time label at the start of every row
      dateGridElements.splice(index + i, 0, this.renderTimeLabel(time))
    }
    return [
      // Empty top left corner
      <div />,
      // Top row of dates
      ...this.dates.map(dayOfTimes => this.renderDateLabel(dayOfTimes[0])),
      // Every row after that
      ...dateGridElements
    ]
  }

  render(): React.Element<*> {
    return (
      <Wrapper>
        <Grid
          columns={this.dates.length}
          rows={this.dates[0].length}
          columnGap={this.props.columnGap}
          rowGap={this.props.rowGap}
          ref={el => {
            this.gridRef = el
          }}
        >
          {this.renderFullDateGrid()}
        </Grid>
      </Wrapper>
    )
  }
}
