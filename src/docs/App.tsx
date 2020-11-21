import * as React from 'react'
import styled, { createGlobalStyle } from 'styled-components'
// eslint-disable-next-line
import * as ReactDOM from 'react-dom'
import Box from './Box'
import * as Text from './Text'
import * as Form from './Form'
import ScheduleSelector from '../lib'
import selectionSchemes, { SelectionSchemeType } from '../lib/selection-schemes'

// eslint-disable-next-line
const GlobalStyle = createGlobalStyle`
  body {
    font-family: sans-serif;
  }

  * {
    box-sizing: border-box;
    margin: 0;
  }
`

const MainDiv = styled.div`
  padding-top: 40px;
  display: flex;
  flex-direction: column;
  align-items: center;
`

const IntroText = styled.div`
  width: 100%;
  text-align: center;
  margin-bottom: 10px;
`

const ScheduleSelectorCard = styled.div`
  border-radius: 25px;
  box-shadow: 10px 2px 30px rgba(0, 0, 0, 0.15);
  padding: 20px;
  width: 90%;
  max-width: 800px;
  & > * {
    flex-grow: 1;
  }
`

const CustomizationRow = styled.div`
  display: flex;
  & > * {
    margin: 8px;
  }
`

const Links = styled.div`
  display: flex;
  margin-top: 20px;
`

const ExternalLink = styled.a`
  background-color: ${props => props.color};
  color: white;
  padding: 10px;
  border-radius: 3px;
  cursor: pointer;
  text-decoration: none;
  margin: 5px;
`

type StateType = {
  schedule: Array<Date>
}

const App = () => {
  const [schedule, setSchedule] = React.useState([])
  const [selectionScheme, setSelectionScheme] = React.useState<SelectionSchemeType>('linear')
  const [startDate, setStartDate] = React.useState<Date>(new Date())
  const [numDays, setNumDays] = React.useState<number>(7)
  const [hourlyChunks, setHourlyChunks] = React.useState<number>(2)
  const [minTime, setMinTime] = React.useState<number>(12)
  const [maxTime, setMaxTime] = React.useState<number>(17)

  return (
    <MainDiv>
      <GlobalStyle />
      <IntroText>
        <Text.PageHeader>React Schedule Selector</Text.PageHeader>
        <Text.Body2>Tap to select one time or drag to select multiple times at once.</Text.Body2>
      </IntroText>
      <Text.SectionHeader>Customizable Props</Text.SectionHeader>
      <CustomizationRow>
        <Box>
          <Form.Label>Selection scheme</Form.Label>
          <Form.Select
            width="100%"
            value={selectionScheme}
            onChange={event => {
              setSelectionScheme(event.target.value as SelectionSchemeType)
            }}
          >
            <option value="linear">Linear</option>
            <option value="square">Square</option>
          </Form.Select>
        </Box>

        <Box>
          <Form.Label>Start date</Form.Label>
          <Form.Input
            type="date"
            value={startDate.toISOString().substr(0, 10)}
            onChange={(event: any) => {
              const date = new Date(event.target.value)
              const tzOffset = date.getTimezoneOffset()
              setStartDate(new Date(+date + tzOffset * 60000))
            }}
          />
        </Box>

        <Box>
          <Form.Label>Num days</Form.Label>
          <Form.Input
            type="number"
            min="1"
            max="14"
            value={numDays}
            onChange={(event: any) => setNumDays(Number(event.target.value))}
          />
        </Box>

        <Box>
          <Form.Label>Min Time</Form.Label>
          <Form.Input
            type="number"
            min="0"
            max={maxTime - 1}
            value={minTime}
            onChange={event => setMinTime(Number(event.target.value))}
          />
        </Box>
        <Box>
          <Form.Label>Max Time</Form.Label>
          <Form.Input
            type="number"
            min={minTime + 1}
            max="24"
            value={maxTime}
            onChange={event => setMaxTime(Number(event.target.value))}
          />
        </Box>
        <Box>
          <Form.Label>Hourly chunks</Form.Label>
          <Form.Input
            type="number"
            min="1"
            max="6"
            value={hourlyChunks}
            onChange={event => setHourlyChunks(Number(event.target.value))}
          />
        </Box>
      </CustomizationRow>
      <ScheduleSelectorCard>
        <ScheduleSelector
          minTime={minTime}
          maxTime={maxTime}
          numDays={numDays}
          startDate={startDate}
          selection={schedule}
          onChange={setSchedule}
          hourlyChunks={hourlyChunks}
          timeFormat="h:mma"
          selectionScheme={selectionScheme}
          blockedTimes={[new Date('2020-11-22T23:00:00.000Z'), new Date('2020-11-22T24:00:00.000Z')]}
        />
      </ScheduleSelectorCard>
      <Links>
        <ExternalLink color="#24292e" href="https://github.com/bibekg/react-schedule-selector">
          GitHub
        </ExternalLink>
        <ExternalLink color="#cb3838" href="https://npmjs.com/package/react-schedule-selector">
          NPM
        </ExternalLink>
        <ExternalLink color="#292929" href="https://medium.com/@bibekg/react-schedule-selector-6cd5bf1f4968">
          Medium
        </ExternalLink>
      </Links>
    </MainDiv>
  )
}

ReactDOM.render(<App />, document.getElementById('app'))
