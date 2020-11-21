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
import selectionSchemes, { SelectionSchemeType, SelectionType } from './selection-schemes'

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  user-select: none;
`

const Grid = styled.div<{ columns: number; rows: number; columnGap: string; rowGap: string }>`
  display: grid;
  grid-template-columns: auto repeat(${props => props.columns}, 1fr);
  grid-template-rows: auto repeat(${props => props.rows}, 1fr);
  column-gap: ${props => props.columnGap};
  row-gap: ${props => props.rowGap};
  width: 100%;
`

export const GridCell = styled.div`
  place-self: stretch;
  touch-action: none;
`

type DateCellProps = {
  blocked: boolean
  selected: boolean
  selectedColor: string
  unselectedColor: string
  blockedColor: string
  hoveredColor: string
}
const getDateCellColor = (props: DateCellProps) => {
  if (props.blocked) {
    return props.blockedColor
  } else if (props.selected) {
    return props.selectedColor
  } else {
    return props.unselectedColor
  }
}

const DateCell = styled.div<DateCellProps>`
  width: 100%;
  height: 25px;
  background-color: ${getDateCellColor};

  ${props =>
    !props.blocked
      ? `
    &:hover {
      background-color: ${props.hoveredColor};
    }
  `
      : ''}
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

interface DateCellRendererProps {
  datetime: Date
  // Indicates whether the specified time is prevented from being selectable
  blocked: boolean
  selected: boolean
  refSetter: (dateCellElement: HTMLElement) => void
}

type PropsType = {
  selection: Array<Date>
  selectionScheme: SelectionSchemeType
  onChange: (newSelection: Array<Date>) => void
  startDate: Date
  numDays: number
  minTime: number
  maxTime: number
  hourlyChunks: number
  dateFormat: string
  timeFormat: string
  columnGap: string
  rowGap: string
  unselectedColor: string
  selectedColor: string
  blockedColor: string
  hoveredColor: string
  blockedTimes: Array<Date>
  renderCell?: (props: DateCellRendererProps) => JSX.Element
  renderTimeLabel?: (time: Date) => JSX.Element
  renderDateLabel?: (date: Date) => JSX.Element
}

type StateType = {
  // In the case that a user is drag-selecting, we don't want to call this.props.onChange() until they have completed
  // the drag-select. selectionDraft serves as a temporary copy during drag-selects.
  selectionDraft: Array<Date>
  selectionType: SelectionType | null
  selectionStart: Date | null
  isTouchDragging: boolean
  dates: Array<Array<Date>>
}

export const preventScroll = (e: TouchEvent) => {
  e.preventDefault()
}

export default class ScheduleSelector extends React.Component<PropsType, StateType> {
  cellToDate: Map<Element, Date> = new Map()

  static defaultProps: Partial<PropsType> = {
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
    blockedColor: colors.paleRed,
    hoveredColor: colors.lightBlue,
    blockedTimes: [],
    onChange: () => {}
  }

  static getDerivedStateFromProps(props: PropsType, state: StateType): Partial<StateType> | null {
    // As long as the user isn't in the process of selecting, allow prop changes to re-populate selection state
    if (state.selectionStart == null) {
      return {
        selectionDraft: [...props.selection],
        dates: ScheduleSelector.computeDatesMatrix(props)
      }
    }
    return null
  }

  static computeDatesMatrix(props: PropsType): Array<Array<Date>> {
    const startTime = startOfDay(props.startDate)
    const dates: Array<Array<Date>> = []
    const minutesInChunk = Math.floor(60 / props.hourlyChunks)
    for (let d = 0; d < props.numDays; d += 1) {
      const currentDay = []
      for (let h = props.minTime; h < props.maxTime; h += 1) {
        for (let c = 0; c < props.hourlyChunks; c += 1) {
          currentDay.push(addMinutes(addHours(addDays(startTime, d), h), c * minutesInChunk))
        }
      }
      dates.push(currentDay)
    }
    return dates
  }

  constructor(props: PropsType) {
    super(props)

    this.state = {
      selectionDraft: [...this.props.selection], // copy it over
      selectionType: null,
      selectionStart: null,
      isTouchDragging: false,
      dates: ScheduleSelector.computeDatesMatrix(props)
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
        // @ts-ignore
        dateCell.addEventListener('touchmove', preventScroll, { passive: false })
      }
    })
  }

  componentWillUnmount() {
    document.removeEventListener('mouseup', this.endSelection)
    this.cellToDate.forEach((value, dateCell) => {
      if (dateCell && dateCell.removeEventListener) {
        // @ts-ignore
        dateCell.removeEventListener('touchmove', preventScroll)
      }
    })
  }

  // Performs a lookup into this.cellToDate to retrieve the Date that corresponds to
  // the cell where this touch event is right now. Note that this method will only work
  // if the event is a `touchmove` event since it's the only one that has a `touches` list.
  getTimeFromTouchEvent(event: React.TouchEvent<any>): Date | null {
    const { touches } = event
    if (!touches || touches.length === 0) return null
    const { clientX, clientY } = touches[0]
    const targetElement = document.elementFromPoint(clientX, clientY)
    if (targetElement) {
      const cellTime = this.cellToDate.get(targetElement)
      return cellTime ?? null
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
  updateAvailabilityDraft(selectionEnd: Date | null, callback?: () => void) {
    const { selectionType, selectionStart } = this.state

    if (selectionType === null || selectionStart === null) return

    let newSelection: Array<Date> = []
    if (selectionStart && selectionEnd && selectionType) {
      newSelection = selectionSchemes[this.props.selectionScheme](
        selectionStart,
        selectionEnd,
        this.state.dates
      ).filter(selectedTime => !this.isTimeBlocked(selectedTime))
    }

    let nextDraft = [...this.props.selection]
    if (selectionType === 'add') {
      nextDraft = Array.from(new Set([...nextDraft, ...newSelection]))
    } else if (selectionType === 'remove') {
      nextDraft = nextDraft.filter(a => !newSelection.find(b => isSameMinute(a, b)))
    }

    this.setState({ selectionDraft: nextDraft }, callback)
  }

  isTimeBlocked(time: Date) {
    return this.props.blockedTimes.find(blockedTime => blockedTime.toISOString() === time.toISOString()) !== undefined
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

  handleTouchMoveEvent(event: React.TouchEvent) {
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

  renderCellWrapper = (time: Date): JSX.Element => {
    const startHandler = () => {
      this.handleSelectionStartEvent(time)
    }

    const selected = Boolean(this.state.selectionDraft.find(a => isSameMinute(a, time)))
    const blocked = this.isTimeBlocked(time)

    const unblockedCellProps = {
      // Mouse handlers
      onMouseDown: startHandler,
      onMouseEnter: () => {
        this.handleMouseEnterEvent(time)
      },
      onMouseUp: () => {
        this.handleMouseUpEvent(time)
      },
      // Touch handlers
      // Since touch events fire on the event where the touch-drag started, there's no point in passing
      // in the time parameter, instead these handlers will do their job using the default Event
      // parameters
      onTouchStart: startHandler,
      onTouchMove: this.handleTouchMoveEvent,
      onTouchEnd: this.handleTouchEndEvent
    }

    return (
      <GridCell
        className="rgdp__grid-cell"
        role="presentation"
        key={time.toISOString()}
        {...(!blocked ? unblockedCellProps : {})}
      >
        {this.renderCell(time, selected, blocked)}
      </GridCell>
    )
  }

  renderCell = (time: Date, selected: boolean, blocked: boolean): JSX.Element => {
    const refSetter = (dateCell: HTMLElement | null) => {
      if (dateCell) {
        this.cellToDate.set(dateCell, time)
      }
    }

    if (this.props.renderCell) {
      return this.props.renderCell({ datetime: time, blocked, selected, refSetter })
    } else {
      return (
        <DateCell
          blocked={blocked}
          selected={selected}
          ref={refSetter}
          selectedColor={this.props.selectedColor}
          unselectedColor={this.props.unselectedColor}
          blockedColor={this.props.blockedColor}
          hoveredColor={this.props.hoveredColor}
        />
      )
    }
  }

  renderTimeLabel = (time: Date): JSX.Element => {
    if (this.props.renderTimeLabel) {
      return this.props.renderTimeLabel(time)
    } else {
      return <TimeText>{formatDate(time, this.props.timeFormat)}</TimeText>
    }
  }

  renderDateLabel = (date: Date): JSX.Element => {
    if (this.props.renderDateLabel) {
      return this.props.renderDateLabel(date)
    } else {
      return <DateLabel>{formatDate(date, this.props.dateFormat)}</DateLabel>
    }
  }

  renderFullDateGrid(): Array<JSX.Element> {
    const flattenedDates: Date[] = []
    const numDays = this.state.dates.length
    const numTimes = this.state.dates[0].length
    for (let j = 0; j < numTimes; j += 1) {
      for (let i = 0; i < numDays; i += 1) {
        flattenedDates.push(this.state.dates[i][j])
      }
    }
    const dateGridElements = flattenedDates.map(this.renderCellWrapper)
    for (let i = 0; i < numTimes; i += 1) {
      const index = i * numDays
      const time = this.state.dates[0][i]
      // Inject the time label at the start of every row
      dateGridElements.splice(index + i, 0, this.renderTimeLabel(time))
    }
    return [
      // Empty top left corner
      <div key="topleft" />,
      // Top row of dates
      ...this.state.dates.map((dayOfTimes, index) =>
        React.cloneElement(this.renderDateLabel(dayOfTimes[0]), { key: `date-${index}` })
      ),
      // Every row after that
      ...dateGridElements.map((element, index) => React.cloneElement(element, { key: `time-${index}` }))
    ]
  }

  render(): JSX.Element {
    return (
      <Wrapper>
        <Grid
          columns={this.state.dates.length}
          rows={this.state.dates[0].length}
          columnGap={this.props.columnGap}
          rowGap={this.props.rowGap}
        >
          {this.renderFullDateGrid()}
        </Grid>
      </Wrapper>
    )
  }
}
