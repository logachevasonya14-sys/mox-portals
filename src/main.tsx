/**
 * Точка входа: монтирует приложение в <div id="root"> из index.html
 * и оборачивает его в ErrorBoundary — экран «Что-то пошло не так» вместо белой страницы.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { clearAppStorage } from './logic'
import './styles.css'

// React catches render errors only in class components, so this one stays a class.
class ErrorBoundary extends React.Component<React.PropsWithChildren, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="fatal-state">
        <div className="empty-or-error-card">
          <p className="eyebrow">СБОЙ СИСТЕМЫ ЛАБОРАТОРИИ</p>
          <h1>Что-то пошло не так.</h1>
          <p>Не удалось безопасно показать данные порталов.</p>
          <div className="header-actions centered">
            <button className="primary-button" onClick={() => window.location.reload()}>
              Перезагрузить
            </button>
            <button
              className="ghost-button"
              onClick={() => {
                clearAppStorage()
                window.location.reload()
              }}
            >
              Сбросить сохранённые данные
            </button>
          </div>
        </div>
      </main>
    )
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
