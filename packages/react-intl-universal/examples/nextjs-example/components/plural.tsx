import React from 'react'
import ExampleBlock from 'components/example-block';

const PluralComponent: React.FC<any> = () => {
  return (
    <div>
      <div className="title">Plural messages</div>
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 0 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 1 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
      <ExampleBlock code={'<div>{intl.get("PHOTO", { photoNum: 1000000 }).d("You have {photoNum, plural, =0 {no photos.} =1 {one photo.} other {# photos.}}")}</div>'} />
    </div>
  );
}

export default PluralComponent;
