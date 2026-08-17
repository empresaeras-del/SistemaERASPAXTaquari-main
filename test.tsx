import React from 'react';
export const Test = () => {
  return <div>
    {true ? (<div>A</div>) : (<div>B</div>)}
    <form>
      {true ? (<div>C</div>) : null}
    </form>
  </div>
}
