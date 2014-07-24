/* Copyright (c) 2014 Richard Rodger, MIT License */
"use strict";


var _   = require('underscore')
var nid = require('nid')



module.exports = function( options ) {
  var seneca = this
  var plugin = 'card'


  options = seneca.util.deepextend({

  },options)
  


  seneca.add({
    role: plugin,
    make: 'top',

  }, make_top)


  seneca.add({
    role: plugin,
    cmd: 'children',

  }, cmd_children)



/*
  seneca.add({
    role: plugin,
    cmd: 'move',

  }, cmd_move)

  seneca.add({
    role: plugin,
    cmd: 'order',

  }, cmd_order)
*/



  seneca.add({
    role: plugin,
    cmd: 'relate',

  }, cmd_relate)


  seneca.add({
    role: 'entity',
    base: 'card',
    cmd:  'save',

  }, card_save)




  var cardent = seneca.make('card/card')
  var topent  = seneca.make('card/top')


  seneca.act({
    role: 'util',
    cmd:  'ensure_entity',

    pin:{role:'card',cmd:'*'},

    entmap:{
      card:cardent
    }
  })


  function make_top(args, done){
    var seneca = this

    var top = topent.make$({
      title: args.title,
    })

    top.save$(function(err,top){
      if(err) return done(err);

      top.parent = top      
      top.save$( function(err,top) {
        if(err) return done(err);

        cardent.load$(top.id,function(err,card){
          if(err) return done(err);

          card.parent = card.id
          card.save$(function(err){
            if(err) return done(err);
            done(null,top)
          })
        })
      })
    })
  }


  function cmd_children( args, done ) {
    var seneca = this

    cardent.load$( args.card.id, function(err,card) {
      if(err) return done(err);

      cardent.list$( {parent:card.id}, function(err,children){
        if(err) return done(err);

        var childmap = {}

        _.each(children,function(child){
          childmap[child.id] =
            {id:child.id, name:child.name, title:child.title}
        })

        var out = []
        _.each(card.children,function(childid){
          if( childmap[childid] )
            out.push( childmap[childid] )
        })

        done(null,{card:args.card.id,children:out})
      })
    })
  }

  
  function cmd_relate( args, done ) {
    var seneca = this

    var content  = args.ent
    var cardname = content.canon$({object:true}).name

    var parentid = args.parent && args.parent.id

    cardent.load$(parentid, function(err,parent){
      if( err ) return done(err);

      cardent.load$(content.id, function(err,card){
        if( err ) return done(err);
        
        if( !card ) {
          card = cardent.make$({
            id$:      content.id,
            title:    content.title,
            name:     cardname,
            parent:   parent && parent.id,
            children: []
          }).save$(update_parent)
        }
        else update_card( null, card, parent )
      })
    })

    function update_card(err,card,parent) {
      if( err ) return done(err);

      card.title   = content.title
      card.name    = cardname
      card.parent  = parent && parent.id
      card.save$( update_parent )
    }

    function update_parent(err,card) {
      if( err ) return done(err);

      if( !card.parent ) 
        return done(null,{content:content,card:card});

      cardent.load$(card.parent, function(err,parent){
        if( err ) return done(err);

        if( card.id != parent.id ) {
          parent.children.push( card.id )
          parent.children = _.uniq(parent.children)
        }

        parent.save$(function(err){
          if( err ) return done(err);
          
          done(null,{content:content,card:card})
        })
      })
    }
    
  }



  function card_save(args, done){
    var seneca = this

    var parent = args.ent.parent

    if( null == args.ent.title ) {
      args.ent.title = nid()
    }

    if( 'card' != args.name ) {
      delete args.ent.parent
      delete args.ent.children
    }

    if( seneca.has('role:entity,base:card,cmd:save') ) {
      return seneca.prior( args, after );
    }
    else {
      delete args.base
      return seneca.act( args, after );
    }

    function after( err, content ) {
      if( err ) return done(err);

      if( 'card' != args.name ) {
        seneca.act(
          {role:plugin,cmd:'relate',ent:content,parent:parent},
          function(err,out){
            if( err ) return done(err);

            out.content.children = out.card.children
            out.content.parent   = parent ? parent.id : out.content.id
            return done(null,out.content)
          })
      }
      else return done(null,content)
    }
  }



  seneca.add({init:plugin}, function( args, done ){
    var seneca = this

    seneca.act('role:util, cmd:define_sys_entity', {list:[
      'card/card'
    ]})

    done()
  })


  return {
    name: plugin
  }
}
