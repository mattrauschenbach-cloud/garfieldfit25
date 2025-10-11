export function Button({ as:Comp='button', variant='default', className='', ...props }){
  const cls = [
    'btn',
    variant==='primary' ? 'primary' : '',
    variant==='ghost' ? 'ghost' : '',
    className
  ].filter(Boolean).join(' ')
  return <Comp className={cls} {...props} />
}
