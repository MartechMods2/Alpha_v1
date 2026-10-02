import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
const flatten = children => Children.toArray(children).flatMap(child => {
  if (!isValidElement(child)) return []
  if (child.type === 'option') return [{ value: String(child.props.value ?? child.props.children), label: child.props.children, disabled: child.props.disabled }]
  return flatten(child.props.children)
})
export default function Select({children,value,defaultValue,onChange,disabled,className='',style,id,name,'aria-label':ariaLabel,...rest}) {
  const options=flatten(children)
  const [internal,setInternal]=useState(defaultValue ?? options[0]?.value ?? '')
  const selected=String(value ?? internal)
  const [open,setOpen]=useState(false)
  const [active,setActive]=useState(0)
  const [position,setPosition]=useState({})
  const button=useRef(null),menu=useRef(null),search=useRef({text:'',at:0})
  const listId=useId()
  const index=options.findIndex(o=>o.value===selected)
  const choose=i=>{
    const item=options[i];if(!item||item.disabled)return
    setInternal(item.value);onChange?.({target:{value:item.value,name},currentTarget:{value:item.value,name}})
    setOpen(false);button.current?.focus()
  }
  useLayoutEffect(()=>{
    if(!open)return
    const place=()=>{const r=button.current.getBoundingClientRect();const height=Math.min(260,options.length*40+12);setPosition({left:Math.max(8,Math.min(r.left,window.innerWidth-r.width-8)),width:Math.min(r.width,window.innerWidth-16),top:r.bottom+height>window.innerHeight?Math.max(8,r.top-height-6):r.bottom+6})}
    place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true)
    return ()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true)}
  },[open,options.length])
  useEffect(()=>{
    if(!open)return
    const outside=event=>{if(!button.current?.contains(event.target)&&!menu.current?.contains(event.target))setOpen(false)}
    document.addEventListener('pointerdown',outside)
    return ()=>document.removeEventListener('pointerdown',outside)
  },[open])
  useEffect(()=>{if(disabled)setOpen(false)},[disabled])
  useEffect(()=>{if(open)document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({block:'nearest'})},[active,open,listId])
  const keyDown=event=>{
    if(event.key==='Escape'||event.key==='Tab'){if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation()}setOpen(false);return}
    if(['Enter',' '].includes(event.key)){event.preventDefault();if(open)choose(active);else{setActive(Math.max(0,index));setOpen(true)};return}
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();setOpen(true)
      let next=event.key==='Home'?0:event.key==='End'?options.length-1:(open?active:Math.max(0,index))+(event.key==='ArrowDown'?1:-1)
      const direction=event.key==='ArrowUp'||event.key==='End'?-1:1
      for(let n=0;n<options.length;n++){next=(next+options.length)%options.length;if(!options[next]?.disabled)break;next+=direction}
      setActive(Math.max(0,next));return
    }
    if(event.key.length===1&&!event.ctrlKey&&!event.metaKey){const now=Date.now();search.current={text:(now-search.current.at>700?'':search.current.text)+event.key.toLowerCase(),at:now};const found=options.findIndex(o=>!o.disabled&&String(o.label).toLowerCase().startsWith(search.current.text));if(found>=0){setActive(found);setOpen(true)}}
  }
  return <div className="alpha-select-wrap" style={style}>
    {name&&<input type="hidden" name={name} value={selected} disabled={disabled}/>}
    <button {...rest} id={id} ref={button} type="button" disabled={disabled || !options.length} className={`alpha-select ${className}`} role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} aria-activedescendant={open?`${listId}-${active}`:undefined} onKeyDown={keyDown} onBlur={event=>{if(!menu.current?.contains(event.relatedTarget))setOpen(false)}} onClick={()=>{setActive(Math.max(0,index));setOpen(v=>!v)}}>
      <span>{options[index]?.label ?? 'Choose an option'}</span><span aria-hidden="true" className="alpha-select-chevron">⌄</span>
    </button>
    {open&&createPortal(<div id={listId} role="listbox" ref={menu} className="alpha-select-menu" style={position} aria-label={ariaLabel||'Options'} onMouseDown={event=>event.preventDefault()}>
      {options.map((option,i)=><div id={`${listId}-${i}`} key={`${option.value}-${i}`} role="option" aria-selected={selected===option.value} aria-disabled={option.disabled||undefined} className={`alpha-select-option ${i===active?'focused':''} ${selected===option.value?'selected':''}`} onPointerMove={()=>!option.disabled&&setActive(i)} onClick={()=>choose(i)}><span>{option.label}</span>{selected===option.value&&<span aria-hidden="true">✓</span>}</div>)}
      {!options.length&&<p className="sub">No options available</p>}
    </div>,document.body)}
  </div>
}
