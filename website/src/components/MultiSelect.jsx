import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Search } from 'lucide-react';

const MultiSelect = ({ 
  options = [], 
  value = [], 
  onChange, 
  placeholder = "Select options...",
  label = "Select options"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    const newValue = value.includes(option)
      ? value.filter(v => v !== option)
      : [...value, option];
    onChange(newValue);
  };

  const removeItem = (e, option) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== option));
  };

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative w-full" ref={containerRef}>
      {label && (
        <label className="text-sm mb-2 text-white/80 block uppercase tracking-wider font-semibold">
          {label}
        </label>
      )}
      
      {/* Input / Chip Container */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          min-h-[50px] w-full bg-[#1E2E2C] border rounded-xl px-3 py-2 cursor-pointer flex flex-wrap gap-2 items-center transition-all
          ${isOpen ? "border-yellow-400 ring-1 ring-yellow-400/20" : "border-white/20 hover:border-white/40"}
        `}
      >
        {value.length > 0 ? (
          value.map(item => (
            <div
              key={item}
              className="bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm"
            >
              {item}
              <button
                type="button"
                aria-label={`Remove ${item}`}
                onClick={(e) => removeItem(e, item)}
                className="cursor-pointer hover:scale-125 transition-transform flex items-center"
              >
                <X size={14} />
              </button>
            </div>
          ))
        ) : (
          <span className="text-white/50 text-sm ml-1">{placeholder}</span>
        )}

        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={label || placeholder}
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          className="ml-auto pr-1 flex items-center"
        >
          <ChevronDown size={18} className={`text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-[100] w-full mt-2 bg-[#2D413F] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in duration-200">
          {/* Search Box */}
          <div className="p-2 border-b border-white/5 flex items-center gap-2 bg-white/5">
            <Search size={16} className="text-white/40 ml-1" />
            <input
              type="text"
              autoFocus
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search contents..."
              className="w-full bg-transparent border-none text-white text-sm focus:outline-none placeholder:text-white/20 py-1"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div role="listbox" aria-multiselectable="true" aria-label={label || placeholder} className="max-h-[250px] overflow-y-auto custom-scrollbar p-1">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => {
                const isSelected = value.includes(opt);
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    key={opt}
                    onClick={() => toggleOption(opt)}
                    className={`
                      w-full text-left px-4 py-2.5 rounded-lg text-sm cursor-pointer flex items-center justify-between transition-colors mb-0.5
                      ${isSelected
                        ? "bg-yellow-400 text-black font-bold"
                        : "text-white/80 hover:bg-white/10 hover:text-white"}
                    `}
                  >
                    {opt}
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black"></div>}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-white/40 text-sm italic">
                No matching options found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
