interface OrbProps {
  status: 'green' | 'yellow' | 'red'
  onClick: () => void
}

function Orb({ status, onClick }: OrbProps): React.JSX.Element {
  return (
    <div className="floating-orb-container">
      <button className={`assistive-touch-orb ${status}`} onClick={onClick}>
        <div className="ring-1">
          <div className="ring-2">
            <div className="ring-center" />
          </div>
        </div>
      </button>
    </div>
  )
}

export default Orb
