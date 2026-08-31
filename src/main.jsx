import React from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import Root from './App';
import './styles.css';
import './dynamic.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><Root/></BrowserRouter>);
