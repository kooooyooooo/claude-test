import React, { useState, useMemo, useCallback } from 'react'
import {
  BarChart, Bar, LineChart, Line, ComposedChart, CartesianGrid,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

// ================== ダミーデータ生成 ==================
const generateDummyData = () => {
  const players = [
    { id: 1, name: '田中太郎', grade: 3, gender: 'M' },
    { id: 2, name: '山田花子', grade: 4, gender: 'F' },
    { id: 3, name: '佐藤健一', grade: 2, gender: 'M' },
    { id: 4, name: '鈴木由美', grade: 5, gender: 'F' },
    { id: 5, name: '伊藤翔太', grade: 1, gender: 'M' },
    { id: 6, name: '渡辺美咲', grade: 6, gender: 'F' },
    { id: 7, name: '中村拓也', grade: 3, gender: 'M' },
    { id: 8, name: '加藤由紀', grade: 4, gender: 'F' },
    { id: 9, name: '斎藤慎也', grade: 5, gender: 'M' },
    { id: 10, name: '高橋美優', grade: 2, gender: 'F' },
    { id: 11, name: '松本悠太', grade: 6, gender: 'M' },
    { id: 12, name: '小林春香', grade: 1, gender: 'F' },
    { id: 13, name: '横田勇気', grade: 4, gender: 'M' },
    { id: 14, name: '新井彩乃', grade: 3, gender: 'F' },
    { id: 15, name: '吉田大樹', grade: 5, gender: 'M' },
  ]

  const sessions = []
  const today = new Date()

  // 35日前から今日までのダミーデータ生成
  const strategicPlayers = {
    7: { rpeMultiplier: 1.8, daysOff: 20 }, // player_id 7: ACWR > 1.5 (赤)
    3: { rpeMultiplier: 1.5, daysOff: 2 },  // player_id 3: ACWR 1.3〜1.5 (黄)
    4: { rpeMultiplier: 1.4, daysOff: 3 },  // player_id 4: ACWR 1.3〜1.5 (黄)
    5: { rpeMultiplier: 0.4, daysOff: 0 },  // player_id 5: ACWR < 0.5 (赤)
  }

  players.forEach(player => {
    const strategy = strategicPlayers[player.id] || { rpeMultiplier: 1.0, daysOff: 0 }

    for (let i = 35; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      // 週に4日程度の練習日（ランダム、でも意図的に調整）
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      const shouldTrain = Math.random() < (isWeekend ? 0.3 : 0.7)

      if (!shouldTrain || i <= strategy.daysOff) continue

      const duration = Math.floor(Math.random() * 60) + 60 // 60〜120分
      let rpe = Math.floor(Math.random() * 5) + 3 // 3〜7
      rpe = Math.floor(rpe * strategy.rpeMultiplier)
      rpe = Math.max(1, Math.min(10, rpe)) // 1〜10に制限

      const load = duration * rpe

      sessions.push({
        id: sessions.length + 1,
        player_id: player.id,
        date: dateStr,
        duration_min: duration,
        rpe: rpe,
        memo: '',
        load: load,
      })
    }
  })

  return { players, sessions }
}

// ================== ACWR計算ロジック ==================
const calculateACWR = (sessions, playerId, referenceDate) => {
  const refDate = new Date(referenceDate)

  // 直近7日
  const acuteStart = new Date(refDate)
  acuteStart.setDate(acuteStart.getDate() - 6)
  const acuteLoads = sessions
    .filter(s => s.player_id === playerId && new Date(s.date) >= acuteStart && new Date(s.date) <= refDate)
    .map(s => s.load)
  const acuteAvg = acuteLoads.length > 0 ? acuteLoads.reduce((a, b) => a + b, 0) / acuteLoads.length : 0

  // 直近28日
  const chronicStart = new Date(refDate)
  chronicStart.setDate(chronicStart.getDate() - 27)
  const chronicLoads = sessions
    .filter(s => s.player_id === playerId && new Date(s.date) >= chronicStart && new Date(s.date) <= refDate)
    .map(s => s.load)
  const chronicAvg = chronicLoads.length > 0 ? chronicLoads.reduce((a, b) => a + b, 0) / chronicLoads.length : 0

  const acwr = chronicAvg > 0 ? acuteAvg / chronicAvg : null

  return {
    acuteAvg: Math.round(acuteAvg),
    chronicAvg: Math.round(chronicAvg),
    acwr: acwr ? parseFloat(acwr.toFixed(2)) : null,
  }
}

const getStatusColor = (acwr) => {
  if (acwr === null) return 'gray'
  if (acwr >= 0.8 && acwr <= 1.3) return 'green'
  if ((acwr >= 0.5 && acwr < 0.8) || (acwr > 1.3 && acwr <= 1.5)) return 'yellow'
  if (acwr < 0.5 || acwr > 1.5) return 'red'
  return 'gray'
}

const getStatusLabel = (color) => {
  switch (color) {
    case 'green': return '適正'
    case 'yellow': return '注意'
    case 'red': return 'リスク'
    default: return 'N/A'
  }
}

// ================== コンポーネント ==================
const Header = ({ mode, onModeChange }) => (
  <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 shadow-md sticky top-0 z-50">
    <div className="max-w-6xl mx-auto flex items-center justify-between">
      <h1 className="text-xl md:text-2xl font-bold">🏐 選手コンディショニング管理</h1>
      <div className="flex items-center gap-2">
        <span className="text-sm md:text-base">{mode === 'player' ? '選手モード' : 'コーチモード'}</span>
        <button
          onClick={() => onModeChange(mode === 'player' ? 'coach' : 'player')}
          className="bg-white text-blue-600 px-3 md:px-4 py-1 md:py-2 rounded font-semibold text-sm md:text-base hover:bg-gray-100 transition"
        >
          切替
        </button>
      </div>
    </div>
  </header>
)

const Toast = ({ message, type }) => {
  if (!message) return null
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500'
  return (
    <div className={`${bgColor} text-white px-4 py-2 rounded shadow-lg fixed bottom-4 right-4 animate-pulse`}>
      {message}
    </div>
  )
}

const PlayerMode = ({ players, sessions, onAddSession }) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState(players[0]?.id || null)
  const [date, setDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [duration, setDuration] = useState(60)
  const [rpe, setRpe] = useState(5)
  const [memo, setMemo] = useState('')
  const [toast, setToast] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedPlayerId || !date || !duration || !rpe) {
      setToast('すべての項目を入力してください')
      return
    }

    const load = duration * rpe
    onAddSession({
      player_id: parseInt(selectedPlayerId),
      date,
      duration_min: parseInt(duration),
      rpe: parseInt(rpe),
      memo,
      load,
    })

    setDuration(60)
    setRpe(5)
    setMemo('')
    setToast(`${players.find(p => p.id === parseInt(selectedPlayerId))?.name || '選手'}の記録を追加しました！`)
    setTimeout(() => setToast(null), 3000)
  }

  const selectedPlayer = players.find(p => p.id === parseInt(selectedPlayerId))
  const playerSessions = sessions
    .filter(s => s.player_id === parseInt(selectedPlayerId))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">{selectedPlayer?.name || '選手'}の練習記録</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">選手</label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {players.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.grade}年 {p.gender === 'M' ? '男' : '女'})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">練習時間（分）</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="300"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              疲労度（RPE）: {rpe} / 10
            </label>
            <input
              type="range"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              min="1"
              max="10"
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>楽</span>
              <span>最大</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">メモ（任意）</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="怪我、疲労など"
              rows="2"
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded font-semibold hover:bg-blue-700 transition"
          >
            記録する
          </button>
        </div>
      </form>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold mb-4">直近7日の記録</h3>
        {playerSessions.length === 0 ? (
          <p className="text-gray-500">記録がありません</p>
        ) : (
          <div className="space-y-2">
            {playerSessions.map(session => (
              <div key={session.id} className="flex justify-between items-start p-3 bg-gray-50 rounded border">
                <div>
                  <p className="font-semibold">{session.date}</p>
                  <p className="text-sm text-gray-600">{session.duration_min}分 × RPE {session.rpe} = Load {session.load}</p>
                  {session.memo && <p className="text-sm text-gray-500">{session.memo}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Toast message={toast} type={toast?.includes('追加') ? 'success' : 'error'} />
    </div>
  )
}

const CoachDashboard = ({ players, sessions }) => {
  const today = new Date()
  const playerStats = useMemo(() => {
    return players.map(player => {
      const { acwr, acuteAvg, chronicAvg } = calculateACWR(sessions, player.id, today)
      const statusColor = getStatusColor(acwr)
      const lastSession = sessions
        .filter(s => s.player_id === player.id)
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0]

      return {
        ...player,
        acwr,
        acuteAvg,
        chronicAvg,
        statusColor,
        lastSessionDate: lastSession?.date || 'N/A',
      }
    })
  }, [players, sessions])

  const redCount = playerStats.filter(p => p.statusColor === 'red').length
  const yellowCount = playerStats.filter(p => p.statusColor === 'yellow').length
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const getColorClass = (color) => {
    switch (color) {
      case 'green': return 'bg-green-100 border-green-300'
      case 'yellow': return 'bg-yellow-100 border-yellow-300'
      case 'red': return 'bg-red-100 border-red-300'
      default: return 'bg-gray-100 border-gray-300'
    }
  }

  const getBadgeClass = (color) => {
    switch (color) {
      case 'green': return 'bg-green-500 text-white'
      case 'yellow': return 'bg-yellow-500 text-white'
      case 'red': return 'bg-red-500 text-white'
      default: return 'bg-gray-500 text-white'
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-500 text-white rounded-lg shadow p-4">
          <p className="text-sm opacity-90">全選手数</p>
          <p className="text-3xl font-bold">{players.length}</p>
        </div>
        <div className="bg-red-500 text-white rounded-lg shadow p-4">
          <p className="text-sm opacity-90">リスク状態</p>
          <p className="text-3xl font-bold">{redCount}</p>
        </div>
        <div className="bg-yellow-500 text-white rounded-lg shadow p-4">
          <p className="text-sm opacity-90">注意状態</p>
          <p className="text-3xl font-bold">{yellowCount}</p>
        </div>
      </div>

      {/* 選手一覧テーブル */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-200">
              <tr>
                <th className="px-3 py-3 text-left text-sm font-semibold">名前</th>
                <th className="px-3 py-3 text-left text-sm font-semibold">学年</th>
                <th className="px-3 py-3 text-right text-sm font-semibold">直近7日平均</th>
                <th className="px-3 py-3 text-right text-sm font-semibold">ACWR</th>
                <th className="px-3 py-3 text-center text-sm font-semibold">状態</th>
                <th className="px-3 py-3 text-left text-sm font-semibold">最終入力</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map((stat, idx) => (
                <tr
                  key={stat.id}
                  className={`border-b cursor-pointer hover:bg-gray-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${getColorClass(stat.statusColor)}`}
                  onClick={() => setSelectedPlayer(stat)}
                >
                  <td className="px-3 py-3 text-sm font-medium">{stat.name}</td>
                  <td className="px-3 py-3 text-sm">{stat.grade}年</td>
                  <td className="px-3 py-3 text-sm text-right">{stat.acuteAvg}</td>
                  <td className="px-3 py-3 text-sm text-right font-semibold">
                    {stat.acwr !== null ? stat.acwr.toFixed(2) : '-'}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={`px-2 py-1 text-xs font-bold rounded-full ${getBadgeClass(stat.statusColor)}`}>
                      {getStatusLabel(stat.statusColor)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{stat.lastSessionDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 選手詳細モーダル */}
      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          sessions={sessions}
          onClose={() => setSelectedPlayer(null)}
        />
      )}
    </div>
  )
}

const PlayerDetailModal = ({ player, sessions, onClose }) => {
  const playerSessions = sessions
    .filter(s => s.player_id === player.id)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-35)

  const chartData = playerSessions.map(session => {
    const acwrData = calculateACWR(sessions, player.id, session.date)
    return {
      date: session.date.slice(5),
      load: session.load,
      acwr: acwrData.acwr,
    }
  })

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-100 border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">{player.name} - 詳細分析</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-black font-bold text-2xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">学年</p>
              <p className="text-lg font-bold">{player.grade}年</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">性別</p>
              <p className="text-lg font-bold">{player.gender === 'M' ? '男' : '女'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">現在ACWR</p>
              <p className="text-lg font-bold">{player.acwr !== null ? player.acwr.toFixed(2) : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">状態</p>
              <p className={`text-lg font-bold px-2 py-1 rounded text-white ${
                player.statusColor === 'green' ? 'bg-green-500' :
                player.statusColor === 'yellow' ? 'bg-yellow-500' :
                'bg-red-500'
              }`}>
                {getStatusLabel(player.statusColor)}
              </p>
            </div>
          </div>

          {/* グラフ */}
          {chartData.length > 0 ? (
            <div>
              <h3 className="font-semibold mb-4">過去35日の負荷とACWR推移</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis yAxisId="left" label={{ value: 'Load', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: 'ACWR', angle: 90, position: 'insideRight' }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="load" fill="#3b82f6" name="日次負荷" />
                  <Line yAxisId="right" type="monotone" dataKey="acwr" stroke="#ef4444" name="ACWR" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-gray-500">データがありません</p>
          )}

          {/* 記録一覧 */}
          <div>
            <h3 className="font-semibold mb-4">記録一覧（直近15件）</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {playerSessions.slice(-15).reverse().map(session => (
                <div key={session.id} className="p-3 bg-gray-50 rounded border">
                  <p className="font-semibold">{session.date}</p>
                  <p className="text-sm text-gray-600">{session.duration_min}分 × RPE {session.rpe} = Load {session.load}</p>
                  {session.memo && <p className="text-sm text-gray-500">メモ: {session.memo}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ================== Main App ==================
export default function App() {
  const [data] = useState(() => generateDummyData())
  const [mode, setMode] = useState('coach')
  const [sessions, setSessions] = useState(data.sessions)

  const handleAddSession = useCallback((newSession) => {
    const id = Math.max(...sessions.map(s => s.id), 0) + 1
    setSessions(prev => [...prev, { ...newSession, id }])
  }, [sessions])

  return (
    <div className="min-h-screen bg-gray-100">
      <Header mode={mode} onModeChange={setMode} />
      {mode === 'player' ? (
        <PlayerMode players={data.players} sessions={sessions} onAddSession={handleAddSession} />
      ) : (
        <CoachDashboard players={data.players} sessions={sessions} />
      )}
    </div>
  )
}
