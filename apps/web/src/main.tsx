import React from 'react'
import ReactDOM from 'react-dom/client'
import {
    createRouter,
    createRootRoute,
    createRoute,
    RouterProvider,
    Outlet
} from '@tanstack/react-router'
import { ChatPage } from './pages/ChatPage'
import './styles.css'

// Root layout
const rootRoute = createRootRoute({
    component: () => (
        <>
            <Outlet />
        </>
    )
})

// Chat page (index route)
const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: ChatPage
})

// Create the router
const routeTree = rootRoute.addChildren([indexRoute])
const router = createRouter({ routeTree })

// Render
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
)
