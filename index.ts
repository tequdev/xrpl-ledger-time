import { Client, rippleTimeToUnixTime } from 'xrpl'

const GENESIS_LEDGER = 32570 // 2013-Jan-01 03:21:10 UTC

const expectedLedgerIndexDiff = (targetDatetime: number, ledgerDatetime: number) => {
  let sub_sec = targetDatetime - ledgerDatetime
  const plusOrMinus = sub_sec < 0 ? -1 : 1
  sub_sec = Math.abs(sub_sec)
  const LEDGER_PER_SEC =
    ledgerDatetime < Date.UTC(2013, 3 - 1, 10) / 1000 ? 1 / 15 :
      ledgerDatetime < Date.UTC(2013, 9 - 1, 3) / 1000 ? 1 / 10 :
        ledgerDatetime < Date.UTC(2016, 2 - 10, 3) / 1000 ? 1 / 7 :
          1 / 4
  if (sub_sec <= 10) {
    return plusOrMinus * 1
  }
  return plusOrMinus * (Math.ceil(LEDGER_PER_SEC * sub_sec) - 1)
}

const client = new Client('wss://xrpl.ws')

const fetchLedgerIndexFromUnixTime = async (targetUnixtime: number, initialLedgerIndex?: number) => {
  const targetDatetime = targetUnixtime / 1000
  await client.connect()
  let response = await client.request({
    command: 'ledger',
    ledger_index: initialLedgerIndex || GENESIS_LEDGER,
  })
  let i = 0
  let ledgerDatetime = rippleTimeToUnixTime(response.result.ledger.close_time) / 1000
  let ledger_index = Number(response.result.ledger.ledger_index)

  const queue = []

  do {
    i++
    const expectedDiff = expectedLedgerIndexDiff(targetDatetime, ledgerDatetime)
    response = await client.request({
      command: 'ledger',
      ledger_index: ledger_index + expectedDiff
    })
    ledgerDatetime = rippleTimeToUnixTime(response.result.ledger.close_time) / 1000
    ledger_index = Number(response.result.ledger.ledger_index)
    // console.log(response.result.ledger.close_time_human, ledger_index)

    queue.push({ ledger_index, ledgerDatetime })
    if (queue.length > 4) {
      queue.shift()
      if (queue[0].ledger_index == queue[2].ledger_index && queue[1].ledger_index == queue[3].ledger_index) {
        ledgerDatetime = queue[3].ledger_index > queue[2].ledger_index ? queue[3].ledgerDatetime : queue[2].ledgerDatetime
        ledger_index = queue[3].ledger_index > queue[2].ledger_index ? queue[3].ledger_index : queue[2].ledger_index
        break
      }
    }
  } while (ledgerDatetime != targetDatetime)

  console.log(new Date(ledgerDatetime * 1000).toISOString().split('T')[0], ledger_index, new Date(ledgerDatetime * 1000).toISOString(),i)
  await client.disconnect()
  return ledger_index
}

const main = async () => {
  let targetDatetime = Date.UTC(2018, 10 - 1, 9)
  let leddger_index: number | undefined = undefined
  do {
    leddger_index = await fetchLedgerIndexFromUnixTime(targetDatetime, leddger_index)
    const newDate = new Date(targetDatetime)
    targetDatetime = new Date(newDate.setMonth(newDate.getMonth() + 1)).getTime()
  } while (false &&targetDatetime < Date.UTC(2024, 1 - 1, 1))
}

main()
