import React, {useState, useRef, useEffect} from 'react';
import {ChevronDown} from 'lucide-react';

function Select({value,onChange,children,disabled=false}){
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const options = [];
  React.Children.toArray(children).forEach(child => {
    if (child && child.type === 'option') {
      options.push({ 
        value: child.props.value, 
        label: child.props.children, 
        disabled: child.props.disabled, 
        hidden: child.props.hidden 
      });
    }
  });

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || options.find(opt => !opt.hidden);

  return (
    <div className={`select-wrap custom-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`} ref={containerRef}>
      <div 
        className="select-trigger" 
        onClick={(e) => { e.preventDefault(); if (!disabled) setIsOpen(!isOpen); }} 
        tabIndex={disabled ? -1 : 0} 
        onKeyDown={(e) => { if(!disabled && e.key === 'Enter'){ e.preventDefault(); setIsOpen(!isOpen); } }}
      >
        <span className="select-value">{selectedOption ? selectedOption.label : 'เลือก...'}</span>
        <ChevronDown/>
      </div>
      {isOpen && (
        <div className="select-dropdown">
          {options.map((opt, idx) => {
            if (opt.hidden) return null;
            return (
              <div 
                key={idx}
                className={`select-option ${String(opt.value) === String(value) ? 'selected' : ''} ${opt.disabled ? 'disabled' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  if(!opt.disabled) {
                    onChange(opt.value);
                    setIsOpen(false);
                  }
                }}
              >
                {opt.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Select;
